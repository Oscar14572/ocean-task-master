-- Fix 1: project_members self-insert escalation
DROP POLICY IF EXISTS "members_insert_admin" ON public.project_members;
CREATE POLICY "members_insert_admin"
ON public.project_members
FOR INSERT
TO authenticated
WITH CHECK (public.is_project_admin(project_id, auth.uid()));

-- Fix 2: restrict users_profile reads to shared project members + self
CREATE OR REPLACE FUNCTION public.shares_project_with(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT _a = _b
    OR EXISTS (
      SELECT 1
      FROM public.project_members pm1
      JOIN public.project_members pm2
        ON pm1.project_id = pm2.project_id
      WHERE pm1.user_id = _a AND pm2.user_id = _b
    )
    OR EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.project_members pm ON pm.project_id = p.id
      WHERE (p.owner_id = _a AND pm.user_id = _b)
         OR (p.owner_id = _b AND pm.user_id = _a)
    )
    OR EXISTS (
      SELECT 1 FROM public.projects p1
      JOIN public.projects p2 ON p1.owner_id = _a AND p2.owner_id = _b AND p1.id = p2.id
    )
    OR EXISTS (
      SELECT 1 FROM public.project_invitations
      WHERE (invited_by = _a AND invited_user_id = _b)
         OR (invited_by = _b AND invited_user_id = _a)
    );
$$;

DROP POLICY IF EXISTS "profiles_select_all_authenticated" ON public.users_profile;
CREATE POLICY "profiles_select_shared_projects"
ON public.users_profile
FOR SELECT
TO authenticated
USING (public.shares_project_with(auth.uid(), user_id));