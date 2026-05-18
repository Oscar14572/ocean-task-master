# Plan: Ocean Task Master - Gestor de proyectos colaborativo

Transformación completa de la app actual (tareas simples por usuario) en una plataforma de gestión de proyectos con colaboración, Gantt y resúmenes IA. Mantiene la identidad azul existente.

## 1. Base de datos (migración Supabase)

Nuevas tablas con RLS estricta por membresía:

- **users_profile** — perfil público (full_name, username, avatar_url). Auto-creado por trigger en signup.
- **projects** — name, description, status (`planificacion|en_progreso|pausado|completado`), start_date, end_date, owner_id, access_code, access_code_enabled.
- **project_members** — project_id, user_id, role (`admin|colaborador|observador`), joined_at. UNIQUE(project_id, user_id).
- **project_invitations** — project_id, invited_user_id/email/username, role, status (`pendiente|aceptada|rechazada`), invited_by, responded_at.
- **tasks** — reemplaza la tabla actual. project_id, title, description, status (`pendiente|en_progreso|en_revision|completada`), priority (`baja|media|alta|critica`), start_date, end_date, progress (0–100), main_assignee_id, created_by.
- **task_assignees** — task_id, user_id.
- **task_dependencies** — task_id, depends_on_task_id.
- **task_progress_comments** — project_id, task_id, user_id, comment, progress_reported, type (`avance|bloqueo|comentario`).
- **daily_ai_summaries** — project_id, summary_date, generated_by, content.

**Seguridad (críticO):** funciones SECURITY DEFINER `is_project_member(project_id, user_id)` e `is_project_admin(project_id, user_id)` para evitar recursión RLS. Trigger de validación de fechas (end ≥ start). Trigger `update_updated_at`.

Las tareas existentes se descartan (la tabla actual no tiene project_id; migrar no aporta).

## 2. Backend — Server Function de IA

`src/lib/ai-summary.functions.ts` con `requireSupabaseAuth`:
- Carga comentarios del día agrupados por tarea/usuario.
- Llama a Lovable AI Gateway (`google/gemini-3-flash-preview`) con prompt estructurado.
- Persiste el resumen en `daily_ai_summaries`.
- Valida que el caller sea admin del proyecto.

Registra `attachSupabaseAuth` en `src/start.ts`.

## 3. Frontend — rutas

```text
/                         landing (existente, retoque branding)
/login, /signup           auth (existentes)
/_authenticated
  /dashboard              Home: saludo, mis proyectos, invitaciones, botones Crear/Unirse
  /profile                perfil + logout
  /projects/new           crear proyecto
  /projects/join          unirse con clave
  /projects/$projectId    layout con tabs:
    /resumen              dashboard de stats + avance
    /gantt                diagrama Gantt SVG
    /tareas               lista + filtros + CRUD
    /miembros             lista + invitar + cambiar rol
    /avances              feed de comentarios
    /resumen-ia           lista resúmenes + botón generar
    /configuracion        editar/eliminar proyecto, clave acceso
```

## 4. Componentes clave

- **GanttChart** — SVG responsive: eje X tiempo (días/semanas), eje Y tareas, barras coloreadas por estado, línea vertical "hoy", tooltip al hover, click abre detalle. Soporte móvil con scroll horizontal.
- **TaskDialog** / **ProjectDialog** / **InviteDialog** — modales con react-hook-form + zod.
- **ConfirmDelete** — alert-dialog reutilizable.
- **StatCard**, **StatusBadge**, **PriorityBadge**, **EmptyState**, **LoadingSkeleton**.
- **ProgressFeed** — lista de comentarios con tipo (avance/bloqueo/comentario).
- **InvitationsPanel** — aceptar/rechazar en el home.

## 5. Hooks (TanStack Query)

`use-projects`, `use-project`, `use-members`, `use-invitations`, `use-tasks` (refactor), `use-task-comments`, `use-ai-summaries`. Cada uno con CRUD + invalidación.

## 6. UX

- Toasts (sonner) en cada acción.
- Skeleton loaders en queries.
- Estados vacíos ilustrados.
- Validación zod en todos los forms.
- Confirmación antes de borrar.
- Filtros (estado/prioridad/responsable) y buscador en tareas y proyectos.

## 7. Diseño visual

Mantener tokens OKLCH existentes (azules navy/medio/eléctrico). Añadir:
- Colores Gantt por estado (azul claro / medio / cyan / azul oscuro).
- Indicador rojo sutil para tareas vencidas.

## 8. Orden de ejecución

1. Migración SQL (tablas + RLS + funciones + triggers).
2. Hooks de datos.
3. Layout `/projects/$projectId` + tabs.
4. CRUD proyectos + tareas + miembros + invitaciones.
5. Componente Gantt.
6. Comentarios de avance.
7. Server function IA + UI de resúmenes.
8. Home rediseñado + perfil actualizado.
9. Pulido visual y estados vacíos.

## Notas técnicas

- Reemplaza tabla `tasks` actual (sin `project_id`), por lo que se borra y recrea.
- Email de invitados se resuelve vía `users_profile.email` (sincronizada en trigger). Si el email no existe, se guarda como invitación pendiente por email.
- AI usa `LOVABLE_API_KEY` ya disponible en secretos.
- Gantt sin librería externa: SVG puro para evitar dependencias pesadas.

Confirma para proceder con la migración y la implementación completa. Es un cambio grande (~25 archivos nuevos).
