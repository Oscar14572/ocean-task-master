
-- =========================================================
-- Limpieza: tabla de tareas anterior sin proyecto
-- =========================================================
DROP TABLE IF EXISTS public.tasks CASCADE;

-- =========================================================
-- Función reutilizable updated_at
-- =========================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =========================================================
-- users_profile
-- =========================================================
CREATE TABLE public.users_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  username text UNIQUE,
  email text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.users_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_all_authenticated"
  ON public.users_profile FOR SELECT TO authenticated USING (true);

CREATE POLICY "profiles_insert_own"
  ON public.users_profile FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "profiles_update_own"
  ON public.users_profile FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_users_profile_updated_at
  BEFORE UPDATE ON public.users_profile
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-crear perfil al registrarse
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users_profile (user_id, email, full_name, username)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1) || '_' || substr(NEW.id::text, 1, 6))
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill para usuarios existentes
INSERT INTO public.users_profile (user_id, email, full_name, username)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
  split_part(u.email, '@', 1) || '_' || substr(u.id::text, 1, 6)
FROM auth.users u
ON CONFLICT (user_id) DO NOTHING;

-- =========================================================
-- projects
-- =========================================================
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'planificacion',
  start_date date NOT NULL,
  end_date date NOT NULL,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_code text UNIQUE,
  access_code_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_projects_owner ON public.projects(owner_id);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- project_members
-- =========================================================
CREATE TABLE public.project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'colaborador',
  joined_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);

CREATE INDEX idx_project_members_project ON public.project_members(project_id);
CREATE INDEX idx_project_members_user ON public.project_members(user_id);

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- Funciones SECURITY DEFINER (sin recursión RLS)
-- =========================================================
CREATE OR REPLACE FUNCTION public.is_project_member(_project_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = _project_id AND user_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = _project_id AND owner_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_project_admin(_project_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = _project_id AND owner_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = _project_id AND user_id = _user_id AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.get_project_role(_project_id uuid, _user_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.projects WHERE id = _project_id AND owner_id = _user_id) THEN 'admin'
    ELSE (SELECT role FROM public.project_members WHERE project_id = _project_id AND user_id = _user_id LIMIT 1)
  END;
$$;

-- =========================================================
-- Políticas: projects
-- =========================================================
CREATE POLICY "projects_select_members"
  ON public.projects FOR SELECT TO authenticated
  USING (public.is_project_member(id, auth.uid()));

CREATE POLICY "projects_insert_self"
  ON public.projects FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "projects_update_admin"
  ON public.projects FOR UPDATE TO authenticated
  USING (public.is_project_admin(id, auth.uid()))
  WITH CHECK (public.is_project_admin(id, auth.uid()));

CREATE POLICY "projects_delete_owner"
  ON public.projects FOR DELETE TO authenticated
  USING (auth.uid() = owner_id);

CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger: validar fechas
CREATE OR REPLACE FUNCTION public.validate_project_dates()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.end_date < NEW.start_date THEN
    RAISE EXCEPTION 'La fecha final no puede ser anterior a la fecha inicial';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_projects_validate_dates
  BEFORE INSERT OR UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.validate_project_dates();

-- Trigger: auto-añadir owner como admin member
CREATE OR REPLACE FUNCTION public.add_owner_as_member()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.project_members (project_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'admin')
  ON CONFLICT (project_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_projects_add_owner
  AFTER INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.add_owner_as_member();

-- =========================================================
-- Políticas: project_members
-- =========================================================
CREATE POLICY "members_select_in_project"
  ON public.project_members FOR SELECT TO authenticated
  USING (public.is_project_member(project_id, auth.uid()));

CREATE POLICY "members_insert_admin"
  ON public.project_members FOR INSERT TO authenticated
  WITH CHECK (
    public.is_project_admin(project_id, auth.uid())
    OR auth.uid() = user_id  -- permite que el usuario se auto-añada (clave/invitación)
  );

CREATE POLICY "members_update_admin"
  ON public.project_members FOR UPDATE TO authenticated
  USING (public.is_project_admin(project_id, auth.uid()))
  WITH CHECK (public.is_project_admin(project_id, auth.uid()));

CREATE POLICY "members_delete_admin_or_self"
  ON public.project_members FOR DELETE TO authenticated
  USING (
    public.is_project_admin(project_id, auth.uid())
    OR auth.uid() = user_id
  );

-- =========================================================
-- project_invitations
-- =========================================================
CREATE TABLE public.project_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  invited_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_email text,
  invited_username text,
  role text NOT NULL DEFAULT 'colaborador',
  status text NOT NULL DEFAULT 'pendiente',
  invited_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz
);

CREATE INDEX idx_invitations_project ON public.project_invitations(project_id);
CREATE INDEX idx_invitations_user ON public.project_invitations(invited_user_id);
CREATE INDEX idx_invitations_email ON public.project_invitations(invited_email);

-- evitar duplicados pendientes
CREATE UNIQUE INDEX idx_invitations_unique_pending_user
  ON public.project_invitations(project_id, invited_user_id)
  WHERE status = 'pendiente' AND invited_user_id IS NOT NULL;

ALTER TABLE public.project_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invitations_select_relevant"
  ON public.project_invitations FOR SELECT TO authenticated
  USING (
    auth.uid() = invited_user_id
    OR public.is_project_admin(project_id, auth.uid())
  );

CREATE POLICY "invitations_insert_admin"
  ON public.project_invitations FOR INSERT TO authenticated
  WITH CHECK (
    public.is_project_admin(project_id, auth.uid())
    AND invited_by = auth.uid()
  );

CREATE POLICY "invitations_update_invited_or_admin"
  ON public.project_invitations FOR UPDATE TO authenticated
  USING (
    auth.uid() = invited_user_id
    OR public.is_project_admin(project_id, auth.uid())
  );

CREATE POLICY "invitations_delete_admin"
  ON public.project_invitations FOR DELETE TO authenticated
  USING (public.is_project_admin(project_id, auth.uid()));

-- =========================================================
-- tasks
-- =========================================================
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pendiente',
  priority text NOT NULL DEFAULT 'media',
  start_date date NOT NULL,
  end_date date NOT NULL,
  progress integer NOT NULL DEFAULT 0,
  main_assignee_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_project ON public.tasks(project_id);
CREATE INDEX idx_tasks_assignee ON public.tasks(main_assignee_id);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks_select_members"
  ON public.tasks FOR SELECT TO authenticated
  USING (public.is_project_member(project_id, auth.uid()));

CREATE POLICY "tasks_insert_collab"
  ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (
    public.is_project_member(project_id, auth.uid())
    AND public.get_project_role(project_id, auth.uid()) IN ('admin', 'colaborador')
    AND created_by = auth.uid()
  );

CREATE POLICY "tasks_update_collab"
  ON public.tasks FOR UPDATE TO authenticated
  USING (
    public.is_project_member(project_id, auth.uid())
    AND public.get_project_role(project_id, auth.uid()) IN ('admin', 'colaborador')
  );

CREATE POLICY "tasks_delete_admin"
  ON public.tasks FOR DELETE TO authenticated
  USING (public.is_project_admin(project_id, auth.uid()));

CREATE TRIGGER trg_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.validate_task_dates()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.end_date < NEW.start_date THEN
    RAISE EXCEPTION 'La fecha final no puede ser anterior a la fecha inicial';
  END IF;
  IF NEW.progress < 0 OR NEW.progress > 100 THEN
    RAISE EXCEPTION 'El progreso debe estar entre 0 y 100';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_tasks_validate
  BEFORE INSERT OR UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.validate_task_dates();

-- =========================================================
-- task_assignees
-- =========================================================
CREATE TABLE public.task_assignees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(task_id, user_id)
);

CREATE INDEX idx_task_assignees_task ON public.task_assignees(task_id);

ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_assignees_select"
  ON public.task_assignees FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_id AND public.is_project_member(t.project_id, auth.uid())
  ));

CREATE POLICY "task_assignees_insert_collab"
  ON public.task_assignees FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_id
      AND public.get_project_role(t.project_id, auth.uid()) IN ('admin', 'colaborador')
  ));

CREATE POLICY "task_assignees_delete_collab"
  ON public.task_assignees FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_id
      AND public.get_project_role(t.project_id, auth.uid()) IN ('admin', 'colaborador')
  ));

-- =========================================================
-- task_dependencies
-- =========================================================
CREATE TABLE public.task_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  depends_on_task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(task_id, depends_on_task_id),
  CHECK (task_id <> depends_on_task_id)
);

ALTER TABLE public.task_dependencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_deps_select"
  ON public.task_dependencies FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_id AND public.is_project_member(t.project_id, auth.uid())
  ));

CREATE POLICY "task_deps_insert_collab"
  ON public.task_dependencies FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_id
      AND public.get_project_role(t.project_id, auth.uid()) IN ('admin', 'colaborador')
  ));

CREATE POLICY "task_deps_delete_collab"
  ON public.task_dependencies FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_id
      AND public.get_project_role(t.project_id, auth.uid()) IN ('admin', 'colaborador')
  ));

-- =========================================================
-- task_progress_comments
-- =========================================================
CREATE TABLE public.task_progress_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  comment text NOT NULL,
  progress_reported integer,
  type text NOT NULL DEFAULT 'avance',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_comments_project ON public.task_progress_comments(project_id);
CREATE INDEX idx_comments_task ON public.task_progress_comments(task_id);
CREATE INDEX idx_comments_user ON public.task_progress_comments(user_id);
CREATE INDEX idx_comments_created ON public.task_progress_comments(created_at);

ALTER TABLE public.task_progress_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comments_select_members"
  ON public.task_progress_comments FOR SELECT TO authenticated
  USING (public.is_project_member(project_id, auth.uid()));

CREATE POLICY "comments_insert_members"
  ON public.task_progress_comments FOR INSERT TO authenticated
  WITH CHECK (
    public.is_project_member(project_id, auth.uid())
    AND user_id = auth.uid()
  );

CREATE POLICY "comments_update_own"
  ON public.task_progress_comments FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "comments_delete_own_or_admin"
  ON public.task_progress_comments FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_project_admin(project_id, auth.uid()));

CREATE TRIGGER trg_comments_updated_at
  BEFORE UPDATE ON public.task_progress_comments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- daily_ai_summaries
-- =========================================================
CREATE TABLE public.daily_ai_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  summary_date date NOT NULL DEFAULT CURRENT_DATE,
  generated_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_summaries_project ON public.daily_ai_summaries(project_id);
CREATE INDEX idx_ai_summaries_date ON public.daily_ai_summaries(summary_date);

ALTER TABLE public.daily_ai_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_summaries_select_members"
  ON public.daily_ai_summaries FOR SELECT TO authenticated
  USING (public.is_project_member(project_id, auth.uid()));

CREATE POLICY "ai_summaries_insert_admin"
  ON public.daily_ai_summaries FOR INSERT TO authenticated
  WITH CHECK (
    public.is_project_admin(project_id, auth.uid())
    AND generated_by = auth.uid()
  );

CREATE POLICY "ai_summaries_delete_admin"
  ON public.daily_ai_summaries FOR DELETE TO authenticated
  USING (public.is_project_admin(project_id, auth.uid()));
