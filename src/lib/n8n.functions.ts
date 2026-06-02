import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  projectId: z.string().uuid(),
  dueInDays: z.number().int().min(1).max(60).default(3),
  includeReport: z
    .object({
      label: z.string(),
      content: z.string(),
      kind: z.string(),
      generated_at: z.string(),
    })
    .optional(),
});

export const sendReportToN8n = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => Input.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { projectId, dueInDays, includeReport } = data;

    const webhookUrl = process.env.N8N_WEBHOOK_URL;
    if (!webhookUrl) throw new Error("Webhook de n8n no configurado");

    // Permisos: debe ser miembro
    const { data: project, error: projErr } = await supabase
      .from("projects")
      .select("id, name, description, status, start_date, end_date, owner_id")
      .eq("id", projectId)
      .single();
    if (projErr || !project) throw new Error("Proyecto no encontrado");

    const { data: membership } = await supabase
      .from("project_members")
      .select("role")
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!membership && project.owner_id !== userId) {
      throw new Error("No tienes acceso a este proyecto");
    }

    const today = new Date().toISOString().slice(0, 10);
    const horizon = new Date(Date.now() + dueInDays * 86400000)
      .toISOString()
      .slice(0, 10);

    const { data: tasks } = await supabase
      .from("tasks")
      .select(
        "id, title, description, status, priority, progress, start_date, end_date, main_assignee_id",
      )
      .eq("project_id", projectId)
      .neq("status", "completada")
      .lte("end_date", horizon);

    const { data: summaries } = await supabase
      .from("daily_ai_summaries")
      .select("id, summary_date, content, created_at, generated_by")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(10);

    const userIds = Array.from(
      new Set(
        [
          ...(tasks ?? []).map((t) => t.main_assignee_id).filter(Boolean) as string[],
          ...(summaries ?? []).map((s) => s.generated_by),
        ],
      ),
    );

    const { data: profiles } = userIds.length
      ? await supabase
          .from("users_profile")
          .select("user_id, full_name, username, email")
          .in("user_id", userIds)
      : { data: [] };
    const pmap = new Map((profiles ?? []).map((p) => [p.user_id, p]));

    const emailTargets = (tasks ?? []).map((t) => {
      const a = t.main_assignee_id ? pmap.get(t.main_assignee_id) : null;
      return {
        task_id: t.id,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        progress: t.progress,
        start_date: t.start_date,
        end_date: t.end_date,
        condition: t.end_date < today ? "vencida" : "proxima_a_vencer",
        assignee: a
          ? {
              user_id: a.user_id,
              full_name: a.full_name,
              username: a.username,
              email: a.email,
            }
          : null,
      };
    });

    const payload = {
      generated_at: new Date().toISOString(),
      project: {
        id: project.id,
        name: project.name,
        status: project.status,
        start_date: project.start_date,
        end_date: project.end_date,
      },
      ai_report: includeReport ?? null,
      ai_history: (summaries ?? []).map((s) => ({
        id: s.id,
        summary_date: s.summary_date,
        created_at: s.created_at,
        content: s.content,
        generated_by: pmap.get(s.generated_by) ?? { user_id: s.generated_by },
      })),
      email_targets: emailTargets,
    };

    // n8n acepta GET o POST; intentamos POST primero, fallback a GET con query
    let res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.status === 404 || res.status === 405) {
      const url = new URL(webhookUrl);
      url.searchParams.set("payload", JSON.stringify(payload));
      res = await fetch(url.toString(), { method: "GET" });
    }

    if (!res.ok) {
      throw new Error(`n8n respondió con estado ${res.status}`);
    }

    return {
      ok: true,
      sent_at: new Date().toISOString(),
      tasks_count: emailTargets.length,
      reports_count: payload.ai_history.length,
    };
  });
