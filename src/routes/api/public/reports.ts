import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS },
  });
}

function authorized(request: Request): boolean {
  const expected = process.env.PUBLIC_REPORTS_API_KEY;
  if (!expected) return false;
  const header = request.headers.get("x-api-key") ?? "";
  const bearer = request.headers.get("authorization") ?? "";
  const token = bearer.toLowerCase().startsWith("bearer ")
    ? bearer.slice(7).trim()
    : "";
  return header === expected || token === expected;
}

export const Route = createFileRoute("/api/public/reports")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        if (!authorized(request)) {
          return json({ error: "No autorizado" }, 401);
        }

        const url = new URL(request.url);
        const projectId = url.searchParams.get("project_id");
        const limit = Math.min(
          Math.max(Number(url.searchParams.get("limit")) || 50, 1),
          200,
        );
        const daysParam = Number(url.searchParams.get("due_in_days"));
        const dueInDays = Number.isFinite(daysParam) && daysParam > 0 ? daysParam : 3;

        const today = new Date().toISOString().slice(0, 10);
        const horizon = new Date(Date.now() + dueInDays * 86400000)
          .toISOString()
          .slice(0, 10);

        // Proyectos
        let projectsQuery = supabaseAdmin
          .from("projects")
          .select("id, name, description, status, start_date, end_date, owner_id");
        if (projectId) projectsQuery = projectsQuery.eq("id", projectId);
        const { data: projects, error: projectsErr } = await projectsQuery;
        if (projectsErr) return json({ error: "Error consultando proyectos" }, 500);

        const projectIds = (projects ?? []).map((p) => p.id);
        if (projectIds.length === 0) {
          return json({
            generated_at: new Date().toISOString(),
            projects: [],
            ai_reports: [],
            email_targets: [],
          });
        }

        // Resúmenes IA guardados
        const { data: summaries } = await supabaseAdmin
          .from("daily_ai_summaries")
          .select("id, project_id, summary_date, content, generated_by, created_at")
          .in("project_id", projectIds)
          .order("created_at", { ascending: false })
          .limit(limit);

        // Tareas vencidas o próximas a vencer
        const { data: tasks } = await supabaseAdmin
          .from("tasks")
          .select(
            "id, project_id, title, description, status, priority, progress, start_date, end_date, main_assignee_id",
          )
          .in("project_id", projectIds)
          .neq("status", "completada")
          .lte("end_date", horizon);

        // Perfiles para correos / nombres
        const userIds = Array.from(
          new Set([
            ...(tasks ?? []).map((t) => t.main_assignee_id).filter(Boolean) as string[],
            ...(summaries ?? []).map((s) => s.generated_by),
          ]),
        );
        const { data: profiles } = userIds.length
          ? await supabaseAdmin
              .from("users_profile")
              .select("user_id, full_name, username, email")
              .in("user_id", userIds)
          : { data: [] };
        const profileMap = new Map((profiles ?? []).map((p) => [p.user_id, p]));
        const projectMap = new Map((projects ?? []).map((p) => [p.id, p]));

        const emailTargets = (tasks ?? []).map((t) => {
          const assignee = t.main_assignee_id ? profileMap.get(t.main_assignee_id) : null;
          const project = projectMap.get(t.project_id);
          const overdue = t.end_date < today;
          return {
            task_id: t.id,
            project_id: t.project_id,
            project_name: project?.name ?? null,
            title: t.title,
            description: t.description,
            status: t.status,
            priority: t.priority,
            progress: t.progress,
            start_date: t.start_date,
            end_date: t.end_date,
            condition: overdue ? "vencida" : "proxima_a_vencer",
            assignee: assignee
              ? {
                  user_id: assignee.user_id,
                  full_name: assignee.full_name,
                  username: assignee.username,
                  email: assignee.email,
                }
              : null,
          };
        });

        const aiReports = (summaries ?? []).map((s) => {
          const author = profileMap.get(s.generated_by);
          return {
            id: s.id,
            project_id: s.project_id,
            project_name: projectMap.get(s.project_id)?.name ?? null,
            summary_date: s.summary_date,
            created_at: s.created_at,
            content: s.content,
            generated_by: author
              ? {
                  user_id: author.user_id,
                  full_name: author.full_name,
                  email: author.email,
                }
              : { user_id: s.generated_by },
          };
        });

        return json({
          generated_at: new Date().toISOString(),
          filters: { project_id: projectId, due_in_days: dueInDays, limit },
          projects: projects ?? [],
          ai_reports: aiReports,
          email_targets: emailTargets,
        });
      },
    },
  },
});
