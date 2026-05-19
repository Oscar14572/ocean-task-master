-- Create projects through a SECURITY DEFINER RPC so the owner is always
-- derived from the authenticated Supabase user instead of browser input.

CREATE OR REPLACE FUNCTION public.create_project_for_current_user(
  _name text,
  _description text DEFAULT NULL,
  _start_date date DEFAULT CURRENT_DATE,
  _end_date date DEFAULT CURRENT_DATE,
  _status text DEFAULT 'planificacion'
)
RETURNS public.projects
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _project public.projects;
  _user_id uuid := auth.uid();
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  IF _name IS NULL OR btrim(_name) = '' THEN
    RAISE EXCEPTION 'El nombre del proyecto es obligatorio';
  END IF;

  IF _end_date < _start_date THEN
    RAISE EXCEPTION 'La fecha final no puede ser anterior a la fecha inicial';
  END IF;

  INSERT INTO public.projects (
    name,
    description,
    start_date,
    end_date,
    status,
    owner_id
  )
  VALUES (
    btrim(_name),
    NULLIF(btrim(COALESCE(_description, '')), ''),
    _start_date,
    _end_date,
    COALESCE(_status, 'planificacion'),
    _user_id
  )
  RETURNING * INTO _project;

  INSERT INTO public.project_members (project_id, user_id, role)
  VALUES (_project.id, _user_id, 'admin')
  ON CONFLICT (project_id, user_id) DO NOTHING;

  RETURN _project;
END;
$$;

REVOKE ALL ON FUNCTION public.create_project_for_current_user(text, text, date, date, text) FROM public;
GRANT EXECUTE ON FUNCTION public.create_project_for_current_user(text, text, date, date, text) TO authenticated;
