import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SummaryInput = z.object({ projectId: z.string().uuid() });

export const generateDailySummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => SummaryInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { projectId } = data;

    // Verificar que el usuario es admin
    const { data: roleData } = await supabase
      .from("project_members")
      .select("role")
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .maybeSingle();

    const { data: projectData, error: projErr } = await supabase
      .from("projects")
      .select("name, description, status, start_date, end_date, owner_id")
      .eq("id", projectId)
      .single();
    if (projErr) throw new Error("Proyecto no encontrado");

    const isAdmin = projectData.owner_id === userId || roleData?.role === "admin";
    if (!isAdmin) throw new Error("Solo el administrador puede generar resúmenes");

    // Comentarios del día (últimas 24h)
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: comments } = await supabase
      .from("task_progress_comments")
      .select("comment, type, progress_reported, created_at, task_id, user_id")
      .eq("project_id", projectId)
      .gte("created_at", since)
      .order("created_at", { ascending: true });

    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, title, status, priority, progress, start_date, end_date, main_assignee_id")
      .eq("project_id", projectId);

    const userIds = Array.from(
      new Set((comments ?? []).map((c) => c.user_id).filter(Boolean)),
    ) as string[];
    const { data: profiles } = userIds.length
      ? await supabase.from("users_profile").select("user_id, full_name, username").in("user_id", userIds)
      : { data: [] };

    const profileMap = new Map((profiles ?? []).map((p) => [p.user_id, p.full_name || p.username || "Usuario"]));
    const taskMap = new Map((tasks ?? []).map((t) => [t.id, t]));
    const today = new Date().toISOString().split("T")[0];

    // Construir contexto enriquecido para IA
    const enrichedComments = (comments ?? []).map((c) => ({
      autor: profileMap.get(c.user_id) ?? "Usuario",
      tarea: taskMap.get(c.task_id)?.title ?? "—",
      tipo: c.type,
      progreso_reportado: c.progress_reported,
      mensaje: c.comment,
    }));

    const tasksSummary = (tasks ?? []).map((t) => ({
      titulo: t.title,
      estado: t.status,
      prioridad: t.priority,
      progreso: t.progress,
      vencida: t.end_date < today && t.status !== "completada",
    }));

    const totalTasks = tasksSummary.length;
    const completedTasks = tasksSummary.filter((t) => t.estado === "completada").length;
    const avgProgress = totalTasks
      ? Math.round(tasksSummary.reduce((acc, t) => acc + t.progreso, 0) / totalTasks)
      : 0;
    const overdueTasks = tasksSummary.filter((t) => t.vencida).length;

    const systemPrompt = `Eres un asistente experto en gestión de proyectos. Generas resúmenes diarios claros, accionables y en español, dirigidos al administrador del proyecto. Usa markdown con secciones claras.`;

    const userPrompt = `Genera un resumen diario para el proyecto "${projectData.name}" (estado: ${projectData.status}).

ESTADÍSTICAS GENERALES:
- Total de tareas: ${totalTasks}
- Tareas completadas: ${completedTasks}
- Progreso promedio: ${avgProgress}%
- Tareas vencidas: ${overdueTasks}

TAREAS DEL PROYECTO:
${JSON.stringify(tasksSummary, null, 2)}

AVANCES Y COMENTARIOS DE LAS ÚLTIMAS 24 HORAS (${enrichedComments.length} registros):
${enrichedComments.length ? JSON.stringify(enrichedComments, null, 2) : "Sin avances reportados hoy."}

Genera un resumen estructurado con estas secciones (en markdown):

## 📋 Resumen general del día
## ✅ Tareas con avances importantes
## 👥 Miembros que reportaron progreso
## 🚧 Tareas bloqueadas
## ⚠️ Riesgos detectados
## ⏰ Tareas atrasadas
## 💡 Recomendaciones para mañana
## 📊 Progreso aproximado del proyecto
## 🎯 Acciones sugeridas para el administrador`;

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY no configurada");

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (aiRes.status === 429) throw new Error("Límite de uso alcanzado. Intenta más tarde.");
    if (aiRes.status === 402) throw new Error("Créditos de IA agotados.");
    if (!aiRes.ok) {
      const txt = await aiRes.text();
      throw new Error(`Error de IA: ${txt.slice(0, 200)}`);
    }

    const aiJson = await aiRes.json();
    const content = aiJson.choices?.[0]?.message?.content ?? "No se pudo generar el resumen.";

    const { data: inserted, error: iErr } = await supabase
      .from("daily_ai_summaries")
      .insert({
        project_id: projectId,
        summary_date: today,
        generated_by: userId,
        content,
      })
      .select()
      .single();
    if (iErr) throw new Error(iErr.message);

    return { id: inserted.id, content };
  });
