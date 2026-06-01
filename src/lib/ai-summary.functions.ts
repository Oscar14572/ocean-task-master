import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const AI_KINDS = [
  "resumen_diario",
  "resumen_proyecto",
  "resumen_tarea",
  "riesgos",
  "bloqueos_atrasos",
  "proximos_pasos",
  "comentarios_tarea",
  "reporte_ejecutivo",
  "borrador_correo",
  "clasificar_urgencia",
  "atencion_inmediata",
] as const;

const AiInput = z.object({
  projectId: z.string().uuid(),
  kind: z.enum(AI_KINDS).default("resumen_diario"),
  taskId: z.string().uuid().optional(),
});

const KIND_LABEL: Record<(typeof AI_KINDS)[number], string> = {
  resumen_diario: "Resumen diario",
  resumen_proyecto: "Resumen general del proyecto",
  resumen_tarea: "Resumen de tarea",
  riesgos: "Análisis de riesgos",
  bloqueos_atrasos: "Bloqueos y atrasos",
  proximos_pasos: "Próximos pasos sugeridos",
  comentarios_tarea: "Resumen de comentarios de tarea",
  reporte_ejecutivo: "Reporte ejecutivo",
  borrador_correo: "Borrador de correo (tarea próxima a vencer)",
  clasificar_urgencia: "Clasificación por urgencia",
  atencion_inmediata: "Tareas que requieren atención inmediata",
};

const SAVE_KINDS = new Set([
  "resumen_diario",
  "resumen_proyecto",
  "reporte_ejecutivo",
]);

// Convierte markdown común a texto plano legible
function stripMarkdown(input: string): string {
  if (!input) return "";
  let s = input;
  // code fences ``` ... ```
  s = s.replace(/```[\s\S]*?```/g, (m) => m.replace(/```\w*\n?/g, "").replace(/```/g, ""));
  // inline code
  s = s.replace(/`([^`]+)`/g, "$1");
  // bold/italic markers
  s = s.replace(/\*\*([^*]+)\*\*/g, "$1");
  s = s.replace(/\*([^*]+)\*/g, "$1");
  s = s.replace(/__([^_]+)__/g, "$1");
  s = s.replace(/_([^_]+)_/g, "$1");
  // headers (#, ##, ###) -> mayúsculas
  s = s.replace(/^#{1,6}\s+(.+)$/gm, (_m, t) => String(t).toUpperCase());
  // list markers - * + -> guion limpio
  s = s.replace(/^\s*[-*+]\s+/gm, "- ");
  // numered list dot
  s = s.replace(/^\s*\d+\.\s+/gm, (m) => m.replace(/\s+/g, " "));
  // blockquotes
  s = s.replace(/^\s*>\s?/gm, "");
  // imagen/link [text](url) -> text
  s = s.replace(/!\[[^\]]*\]\([^)]*\)/g, "");
  s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  // remove leftover # and *
  s = s.replace(/[*_`]+/g, "");
  // Quitar emojis básicos
  s = s.replace(
    /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}]/gu,
    "",
  );
  // colapsar saltos de linea triples
  s = s.replace(/\n{3,}/g, "\n\n").trim();
  return s;
}

function isResponseUseful(text: string): boolean {
  if (!text) return false;
  const clean = text.trim();
  if (clean.length < 60) return false;
  const generic = /no tengo (información|datos)|no puedo (ayudarte|generar)|lo siento/i;
  if (generic.test(clean) && clean.length < 200) return false;
  return true;
}

export const generateDailySummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => AiInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { projectId, kind, taskId } = data;

    // Verificar membresía / admin
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
    if (projErr || !projectData) throw new Error("Proyecto no encontrado");

    const isMember = !!roleData || projectData.owner_id === userId;
    if (!isMember) throw new Error("No tienes acceso a este proyecto");

    const isAdmin = projectData.owner_id === userId || roleData?.role === "admin";

    // Algunas opciones requieren rol admin (las que guardan resumen)
    if (SAVE_KINDS.has(kind) && !isAdmin) {
      throw new Error("Solo el administrador puede generar este tipo de reporte");
    }

    // Cargar datos del proyecto
    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, title, description, status, priority, progress, start_date, end_date, main_assignee_id")
      .eq("project_id", projectId);

    const { data: comments } = await supabase
      .from("task_progress_comments")
      .select("comment, type, progress_reported, created_at, task_id, user_id")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });

    const { data: members } = await supabase
      .from("project_members")
      .select("user_id, role")
      .eq("project_id", projectId);

    const userIds = Array.from(
      new Set([
        ...(comments ?? []).map((c) => c.user_id),
        ...(tasks ?? []).map((t) => t.main_assignee_id).filter(Boolean) as string[],
        ...(members ?? []).map((m) => m.user_id),
      ]),
    );
    const { data: profiles } = userIds.length
      ? await supabase.from("users_profile").select("user_id, full_name, username").in("user_id", userIds)
      : { data: [] };
    const nameMap = new Map(
      (profiles ?? []).map((p) => [p.user_id, p.full_name || p.username || "Usuario"]),
    );

    const today = new Date().toISOString().slice(0, 10);
    const taskList = tasks ?? [];
    const commentList = comments ?? [];

    // Validaciones por tipo
    if (taskList.length === 0) {
      throw new Error("No hay tareas en el proyecto. Crea tareas antes de generar un análisis.");
    }

    let targetTask: typeof taskList[number] | null = null;
    if (kind === "resumen_tarea" || kind === "comentarios_tarea" || kind === "borrador_correo") {
      if (!taskId) throw new Error("Selecciona una tarea para este análisis");
      targetTask = taskList.find((t) => t.id === taskId) ?? null;
      if (!targetTask) throw new Error("La tarea no existe en este proyecto");
      if (kind === "comentarios_tarea") {
        const taskComments = commentList.filter((c) => c.task_id === taskId);
        if (taskComments.length === 0) {
          throw new Error("Esta tarea no tiene comentarios o avances registrados.");
        }
      }
    }

    if (kind === "riesgos" || kind === "atencion_inmediata") {
      const hasDates = taskList.some((t) => t.start_date && t.end_date);
      if (!hasDates) throw new Error("No hay suficiente información de fechas para generar un análisis útil.");
    }

    // Construir contexto compacto
    const taskCtx = taskList.map((t) => ({
      id: t.id,
      titulo: t.title,
      descripcion: t.description ?? "",
      estado: t.status,
      prioridad: t.priority,
      progreso: t.progress,
      inicio: t.start_date,
      vencimiento: t.end_date,
      responsable: t.main_assignee_id ? nameMap.get(t.main_assignee_id) ?? "Desconocido" : "Sin responsable",
      vencida: t.end_date < today && t.status !== "completada",
      proxima_a_vencer:
        (new Date(t.end_date).getTime() - new Date(today).getTime()) / 86400000 <= 3 &&
        t.end_date >= today &&
        t.status !== "completada",
    }));

    const commentCtx = commentList.map((c) => ({
      autor: nameMap.get(c.user_id) ?? "Usuario",
      tarea: taskList.find((t) => t.id === c.task_id)?.title ?? "Tarea",
      tipo: c.type,
      progreso_reportado: c.progress_reported,
      mensaje: c.comment,
      fecha: c.created_at.slice(0, 10),
    }));

    const stats = {
      total: taskCtx.length,
      completadas: taskCtx.filter((t) => t.estado === "completada").length,
      en_progreso: taskCtx.filter((t) => t.estado === "en_progreso").length,
      pendientes: taskCtx.filter((t) => t.estado === "pendiente").length,
      vencidas: taskCtx.filter((t) => t.vencida).length,
      proximas: taskCtx.filter((t) => t.proxima_a_vencer).length,
      sin_responsable: taskCtx.filter((t) => t.responsable === "Sin responsable").length,
      criticas: taskCtx.filter((t) => t.prioridad === "critica").length,
      progreso_promedio: taskCtx.length
        ? Math.round(taskCtx.reduce((a, t) => a + t.progreso, 0) / taskCtx.length)
        : 0,
    };

    // Prompts por tipo
    const baseSystem = [
      "Eres un asistente profesional de gestión de proyectos.",
      "Respondes siempre en español, en tono profesional, claro y serio.",
      "REGLAS ESTRICTAS DE FORMATO:",
      "- Devuelve únicamente TEXTO PLANO.",
      "- No uses Markdown: nada de **, __, #, ##, ###, *, _, `, ```",
      "- No uses emojis ni iconos.",
      "- No uses viñetas con * o •. Si necesitas una lista usa guiones simples: '- '.",
      "- Para títulos de sección usa una línea en MAYÚSCULAS seguida de dos saltos de línea.",
      "- No uses frases decorativas ni exageradas.",
      "- No inventes datos. Si falta información, dilo de forma breve y profesional.",
      "- Usa únicamente la información proporcionada (nombres reales de tareas, responsables, fechas, estados, progreso, comentarios).",
    ].join("\n");

    let userPrompt = "";
    const projectHeader = `PROYECTO\nNombre: ${projectData.name}\nEstado: ${projectData.status}\nFechas: ${projectData.start_date} a ${projectData.end_date}\nDescripción: ${projectData.description || "(sin descripción)"}\n\nESTADÍSTICAS\n${JSON.stringify(stats, null, 2)}`;

    switch (kind) {
      case "resumen_diario": {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const recent = commentCtx.filter((c) => c.fecha >= since.slice(0, 10));
        userPrompt = `${projectHeader}\n\nAVANCES ÚLTIMAS 24H (${recent.length})\n${JSON.stringify(recent, null, 2)}\n\nTAREAS\n${JSON.stringify(taskCtx, null, 2)}\n\nGenera un resumen del día con estas secciones en este orden, en texto plano: RESUMEN GENERAL, AVANCES RELEVANTES, RIESGOS O BLOQUEOS, PRÓXIMOS PASOS SUGERIDOS, CONCLUSIÓN.`;
        break;
      }
      case "resumen_proyecto":
        userPrompt = `${projectHeader}\n\nTAREAS\n${JSON.stringify(taskCtx, null, 2)}\n\nAVANCES\n${JSON.stringify(commentCtx.slice(-30), null, 2)}\n\nGenera un resumen general del proyecto con estas secciones: RESUMEN GENERAL, AVANCES RELEVANTES, RIESGOS O BLOQUEOS, PRÓXIMOS PASOS SUGERIDOS, CONCLUSIÓN.`;
        break;
      case "resumen_tarea":
        userPrompt = `${projectHeader}\n\nTAREA OBJETIVO\n${JSON.stringify(taskCtx.find((t) => t.id === taskId), null, 2)}\n\nCOMENTARIOS DE LA TAREA\n${JSON.stringify(commentCtx.filter((c) => taskList.find((t) => t.id === taskId)?.title === c.tarea), null, 2)}\n\nGenera un resumen profesional de la tarea con estas secciones: DESCRIPCIÓN, ESTADO ACTUAL, AVANCES Y COMENTARIOS, RIESGOS, PRÓXIMOS PASOS.`;
        break;
      case "riesgos":
        userPrompt = `${projectHeader}\n\nTAREAS\n${JSON.stringify(taskCtx, null, 2)}\n\nAnaliza únicamente los riesgos reales basados en los datos: tareas vencidas, próximas a vencer, sin responsable, críticas, con progreso bajo, o con bloqueos en comentarios. Devuelve secciones: RIESGOS DETECTADOS, IMPACTO ESTIMADO, ACCIONES RECOMENDADAS.`;
        break;
      case "bloqueos_atrasos":
        userPrompt = `${projectHeader}\n\nTAREAS\n${JSON.stringify(taskCtx.filter((t) => t.vencida || t.proxima_a_vencer), null, 2)}\n\nBLOQUEOS REPORTADOS\n${JSON.stringify(commentCtx.filter((c) => c.tipo === "bloqueo"), null, 2)}\n\nGenera un informe con: TAREAS ATRASADAS, TAREAS BLOQUEADAS, RESPONSABLES INVOLUCRADOS, ACCIONES SUGERIDAS.`;
        break;
      case "proximos_pasos":
        userPrompt = `${projectHeader}\n\nTAREAS\n${JSON.stringify(taskCtx, null, 2)}\n\nSugiere los próximos pasos concretos del proyecto basados en los datos reales. Devuelve secciones: PRIORIDADES INMEDIATAS, PRIORIDADES DE ESTA SEMANA, PRIORIDADES POSTERIORES.`;
        break;
      case "comentarios_tarea": {
        const taskComments = commentCtx.filter((c) => taskList.find((t) => t.id === taskId)?.title === c.tarea);
        userPrompt = `${projectHeader}\n\nTAREA\n${JSON.stringify(taskCtx.find((t) => t.id === taskId), null, 2)}\n\nCOMENTARIOS (${taskComments.length})\n${JSON.stringify(taskComments, null, 2)}\n\nResume los comentarios y avances de la tarea con secciones: RESUMEN DE AVANCES, BLOQUEOS REPORTADOS, ÚLTIMO ESTADO CONOCIDO, RECOMENDACIONES.`;
        break;
      }
      case "reporte_ejecutivo":
        userPrompt = `${projectHeader}\n\nTAREAS\n${JSON.stringify(taskCtx, null, 2)}\n\nGenera un reporte ejecutivo breve y formal con secciones: RESUMEN EJECUTIVO, ESTADO GENERAL, AVANCES CLAVE, RIESGOS PRINCIPALES, RECOMENDACIONES, CONCLUSIÓN. Evita detalles operativos innecesarios.`;
        break;
      case "borrador_correo": {
        const t = taskCtx.find((x) => x.id === taskId);
        const taskComments = commentCtx.filter((c) => t && c.tarea === t.titulo).slice(-5);
        userPrompt = `Prepara un borrador de correo profesional en español dirigido al responsable de una tarea próxima a vencer. No envíes nada, solo redacta el texto.\n\nTAREA\n${JSON.stringify(t, null, 2)}\n\nÚLTIMOS COMENTARIOS\n${JSON.stringify(taskComments, null, 2)}\n\nEl correo debe incluir: saludo profesional, nombre de la tarea, fecha de vencimiento, estado actual, progreso, últimos avances, bloqueos si existen, acción sugerida y cierre profesional. Devuelve únicamente el texto del correo, sin asuntos extra ni explicaciones.`;
        break;
      }
      case "clasificar_urgencia":
        userPrompt = `${projectHeader}\n\nTAREAS\n${JSON.stringify(taskCtx, null, 2)}\n\nClasifica las tareas por urgencia real considerando fecha de vencimiento, estado, progreso y prioridad. Devuelve secciones: URGENCIA CRÍTICA, URGENCIA ALTA, URGENCIA MEDIA, URGENCIA BAJA. Para cada tarea menciona título, responsable y motivo breve.`;
        break;
      case "atencion_inmediata":
        userPrompt = `${projectHeader}\n\nTAREAS\n${JSON.stringify(taskCtx, null, 2)}\n\nIdentifica qué tareas requieren atención inmediata hoy. Solo incluye tareas que realmente lo requieran según los datos. Devuelve secciones: TAREAS QUE REQUIEREN ATENCIÓN INMEDIATA, MOTIVO, ACCIÓN RECOMENDADA. Si no hay ninguna, dilo claramente.`;
        break;
    }

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Servicio de IA no configurado");

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: baseSystem },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (aiRes.status === 429) throw new Error("Demasiadas solicitudes. Intenta de nuevo en unos segundos.");
    if (aiRes.status === 402) throw new Error("Se agotaron los créditos de IA. Contacta al administrador.");
    if (!aiRes.ok) throw new Error("No fue posible generar el análisis en este momento.");

    const aiJson = await aiRes.json();
    const raw = aiJson.choices?.[0]?.message?.content ?? "";
    const content = stripMarkdown(String(raw));

    if (!isResponseUseful(content)) {
      throw new Error("La respuesta generada no fue útil. Intenta nuevamente.");
    }

    let savedId: string | null = null;
    if (SAVE_KINDS.has(kind)) {
      const header = `[${KIND_LABEL[kind]}]\n\n`;
      const { data: inserted } = await supabase
        .from("daily_ai_summaries")
        .insert({
          project_id: projectId,
          summary_date: today,
          generated_by: userId,
          content: header + content,
        })
        .select()
        .single();
      savedId = inserted?.id ?? null;
    }

    return {
      id: savedId,
      kind,
      label: KIND_LABEL[kind],
      content,
      generated_at: new Date().toISOString(),
      saved: SAVE_KINDS.has(kind),
    };
  });
