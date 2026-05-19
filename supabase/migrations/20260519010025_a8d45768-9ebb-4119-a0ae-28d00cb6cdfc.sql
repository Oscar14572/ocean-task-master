
CREATE OR REPLACE FUNCTION public.join_project_by_code(_code text)
RETURNS TABLE(id uuid, name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _project public.projects;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO _project
  FROM public.projects
  WHERE access_code = btrim(_code)
    AND access_code_enabled = true
  LIMIT 1;

  IF _project.id IS NULL THEN
    RAISE EXCEPTION 'Clave inválida o desactivada';
  END IF;

  INSERT INTO public.project_members (project_id, user_id, role)
  VALUES (_project.id, _uid, 'colaborador')
  ON CONFLICT (project_id, user_id) DO NOTHING;

  RETURN QUERY SELECT _project.id, _project.name;
END;
$$;
