import { z } from "zod";

// =============== Esquemas reutilizables ===============

export const projectSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(3, "El nombre debe tener al menos 3 caracteres")
      .max(120, "El nombre no puede superar 120 caracteres"),
    description: z
      .string()
      .trim()
      .max(2000, "La descripción no puede superar 2000 caracteres")
      .optional()
      .or(z.literal("")),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  })
  .refine((v) => v.end_date >= v.start_date, {
    message: "La fecha final no puede ser anterior a la inicial",
    path: ["end_date"],
  });

export type ProjectInput = z.infer<typeof projectSchema>;

export function buildTaskSchema(projectStart: string, projectEnd: string) {
  return z
    .object({
      title: z
        .string()
        .trim()
        .min(3, "El título debe tener al menos 3 caracteres")
        .max(200, "El título no puede superar 200 caracteres"),
      description: z
        .string()
        .trim()
        .max(2000, "La descripción no puede superar 2000 caracteres")
        .optional()
        .or(z.literal("")),
      status: z.enum(["pendiente", "en_progreso", "en_revision", "completada", "bloqueada"]),
      priority: z.enum(["baja", "media", "alta", "critica"]),
      start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
      end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
      progress: z
        .number({ message: "Ingresa un número" })
        .int("Debe ser un número entero")
        .min(0, "El progreso mínimo es 0")
        .max(100, "El progreso máximo es 100"),
      main_assignee_id: z.string().nullable(),
    })
    .refine((v) => v.end_date >= v.start_date, {
      message: "La fecha final no puede ser anterior a la inicial",
      path: ["end_date"],
    })
    .refine((v) => v.start_date >= projectStart, {
      message: `La tarea no puede empezar antes del proyecto (${projectStart})`,
      path: ["start_date"],
    })
    .refine((v) => v.end_date <= projectEnd, {
      message: `La tarea no puede terminar después del proyecto (${projectEnd})`,
      path: ["end_date"],
    });
}

export const inviteEmailSchema = z.object({
  email: z.string().trim().toLowerCase().email("Correo electrónico inválido").max(255),
  role: z.enum(["admin", "colaborador", "observador"]),
});

export const inviteUsernameSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Mínimo 3 caracteres")
    .max(50, "Máximo 50 caracteres")
    .regex(/^[a-zA-Z0-9_.-]+$/, "Solo letras, números, guiones y puntos"),
  role: z.enum(["admin", "colaborador", "observador"]),
});

export const commentSchema = z.object({
  task_id: z.string().uuid("Selecciona una tarea"),
  comment: z
    .string()
    .trim()
    .min(3, "El comentario debe tener al menos 3 caracteres")
    .max(2000, "Máximo 2000 caracteres"),
  type: z.enum(["avance", "bloqueo", "nota"]),
  progress_reported: z.number().int().min(0).max(100),
});

// =============== Helper de errores amigables ===============

/**
 * Traduce errores técnicos/RLS de Supabase a mensajes amigables en español.
 * Si el mensaje ya viene en español (lanzado por nuestros triggers), lo deja igual.
 */
export function friendlyError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  if (!raw) return "Ocurrió un error inesperado";

  // Errores ya traducidos (vienen de nuestros triggers/funciones en español)
  if (/[áéíóúñ]/i.test(raw) || /proyecto|tarea|miembro|administrador|invitación|comentario|fecha|progreso|responsable|autenticado/i.test(raw)) {
    return raw;
  }

  const lower = raw.toLowerCase();
  if (lower.includes("row-level security") || lower.includes("violates row-level")) {
    return "No tienes permisos para realizar esta acción";
  }
  if (lower.includes("duplicate key") || lower.includes("unique constraint")) {
    return "Ya existe un registro con esos datos";
  }
  if (lower.includes("foreign key")) {
    return "No se puede completar: existen datos relacionados";
  }
  if (lower.includes("not authenticated") || lower.includes("jwt")) {
    return "Tu sesión expiró. Inicia sesión nuevamente";
  }
  if (lower.includes("network") || lower.includes("fetch")) {
    return "Error de conexión. Verifica tu internet";
  }
  return "Ocurrió un error. Intenta nuevamente";
}
