
-- 1. Unicidad de miembros por proyecto (evita duplicados)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'project_members_project_user_unique'
  ) THEN
    ALTER TABLE public.project_members
      ADD CONSTRAINT project_members_project_user_unique UNIQUE (project_id, user_id);
  END IF;
END $$;

-- 2. Validación general de proyectos
CREATE OR REPLACE FUNCTION public.validate_project()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF length(btrim(coalesce(NEW.name, ''))) < 3 THEN
    RAISE EXCEPTION 'El nombre del proyecto debe tener al menos 3 caracteres';
  END IF;
  IF NEW.end_date < NEW.start_date THEN
    RAISE EXCEPTION 'La fecha final no puede ser anterior a la fecha inicial';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS projects_validate ON public.projects;
CREATE TRIGGER projects_validate
  BEFORE INSERT OR UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.validate_project();

-- 3. Validación general de tareas (longitud, fechas, progreso, completada->100)
CREATE OR REPLACE FUNCTION public.validate_task()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF length(btrim(coalesce(NEW.title, ''))) < 3 THEN
    RAISE EXCEPTION 'El título de la tarea debe tener al menos 3 caracteres';
  END IF;
  IF NEW.end_date < NEW.start_date THEN
    RAISE EXCEPTION 'La fecha final no puede ser anterior a la fecha inicial';
  END IF;
  IF NEW.progress < 0 OR NEW.progress > 100 THEN
    RAISE EXCEPTION 'El progreso debe estar entre 0 y 100';
  END IF;
  IF NEW.status = 'completada' THEN
    NEW.progress := 100;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tasks_validate ON public.tasks;
CREATE TRIGGER tasks_validate
  BEFORE INSERT OR UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.validate_task();

-- 4. Tareas dentro del rango del proyecto y responsable miembro
CREATE OR REPLACE FUNCTION public.validate_task_within_project()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  p_start date;
  p_end date;
BEGIN
  SELECT start_date, end_date INTO p_start, p_end FROM public.projects WHERE id = NEW.project_id;
  IF p_start IS NULL THEN
    RAISE EXCEPTION 'Proyecto no encontrado';
  END IF;
  IF NEW.start_date < p_start THEN
    RAISE EXCEPTION 'La fecha de inicio de la tarea no puede ser anterior al inicio del proyecto (%)', p_start;
  END IF;
  IF NEW.end_date > p_end THEN
    RAISE EXCEPTION 'La fecha de fin de la tarea no puede ser posterior al fin del proyecto (%)', p_end;
  END IF;
  IF NEW.main_assignee_id IS NOT NULL AND NOT public.is_project_member(NEW.project_id, NEW.main_assignee_id) THEN
    RAISE EXCEPTION 'El responsable asignado no pertenece al proyecto';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tasks_validate_within_project ON public.tasks;
CREATE TRIGGER tasks_validate_within_project
  BEFORE INSERT OR UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.validate_task_within_project();

-- 5. Proteger al último administrador
CREATE OR REPLACE FUNCTION public.prevent_last_admin_removal()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  admin_count int;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.role = 'admin' THEN
      SELECT count(*) INTO admin_count FROM public.project_members
       WHERE project_id = OLD.project_id AND role = 'admin' AND id <> OLD.id;
      IF admin_count = 0 THEN
        RAISE EXCEPTION 'No puedes eliminar al último administrador del proyecto';
      END IF;
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.role = 'admin' AND NEW.role <> 'admin' THEN
      SELECT count(*) INTO admin_count FROM public.project_members
       WHERE project_id = OLD.project_id AND role = 'admin' AND id <> OLD.id;
      IF admin_count = 0 THEN
        RAISE EXCEPTION 'No puedes degradar al último administrador del proyecto';
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS members_prevent_last_admin ON public.project_members;
CREATE TRIGGER members_prevent_last_admin
  BEFORE DELETE OR UPDATE ON public.project_members
  FOR EACH ROW EXECUTE FUNCTION public.prevent_last_admin_removal();

-- 6. Evitar invitaciones duplicadas o a personas ya miembros
CREATE OR REPLACE FUNCTION public.prevent_duplicate_invitation()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.invited_user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = NEW.project_id AND user_id = NEW.invited_user_id
  ) THEN
    RAISE EXCEPTION 'Esta persona ya es miembro del proyecto';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.project_invitations
    WHERE project_id = NEW.project_id
      AND status = 'pendiente'
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND (
        (NEW.invited_user_id IS NOT NULL AND invited_user_id = NEW.invited_user_id)
        OR (NEW.invited_email IS NOT NULL AND invited_email = NEW.invited_email)
      )
  ) THEN
    RAISE EXCEPTION 'Ya existe una invitación pendiente para esta persona';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS invitations_prevent_duplicate ON public.project_invitations;
CREATE TRIGGER invitations_prevent_duplicate
  BEFORE INSERT ON public.project_invitations
  FOR EACH ROW EXECUTE FUNCTION public.prevent_duplicate_invitation();

-- 7. Validación de comentarios/avances
CREATE OR REPLACE FUNCTION public.validate_comment()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF length(btrim(coalesce(NEW.comment, ''))) < 3 THEN
    RAISE EXCEPTION 'El comentario debe tener al menos 3 caracteres';
  END IF;
  IF NEW.progress_reported IS NOT NULL AND (NEW.progress_reported < 0 OR NEW.progress_reported > 100) THEN
    RAISE EXCEPTION 'El progreso reportado debe estar entre 0 y 100';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS comments_validate ON public.task_progress_comments;
CREATE TRIGGER comments_validate
  BEFORE INSERT OR UPDATE ON public.task_progress_comments
  FOR EACH ROW EXECUTE FUNCTION public.validate_comment();

-- 8. Función para reasignar tareas y eliminar miembro atómicamente
CREATE OR REPLACE FUNCTION public.reassign_and_remove_member(
  _project_id uuid,
  _member_user_id uuid,
  _new_assignee_id uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;
  IF NOT public.is_project_admin(_project_id, _uid) THEN
    RAISE EXCEPTION 'Solo el administrador puede eliminar miembros';
  END IF;
  IF _new_assignee_id IS NOT NULL THEN
    IF NOT public.is_project_member(_project_id, _new_assignee_id) THEN
      RAISE EXCEPTION 'El nuevo responsable no pertenece al proyecto';
    END IF;
    UPDATE public.tasks
       SET main_assignee_id = _new_assignee_id
     WHERE project_id = _project_id
       AND main_assignee_id = _member_user_id;
  ELSE
    UPDATE public.tasks
       SET main_assignee_id = NULL
     WHERE project_id = _project_id
       AND main_assignee_id = _member_user_id;
  END IF;
  DELETE FROM public.project_members
   WHERE project_id = _project_id AND user_id = _member_user_id;
END $$;
