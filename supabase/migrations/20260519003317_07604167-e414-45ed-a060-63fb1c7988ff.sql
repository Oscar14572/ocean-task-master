CREATE OR REPLACE FUNCTION public.create_project_for_current_user(
  _name text,
  _description text,
  _start_date date,
  _end_date date,
  _status text DEFAULT 'planificacion'
)
RETURNS public.projects
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.projects;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  INSERT INTO public.projects (name, description, start_date, end_date, status, owner_id)
  VALUES (_name, _description, _start_date, _end_date, COALESCE(_status, 'planificacion'), _uid)
  RETURNING * INTO _row;
  RETURN _row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_project_for_current_user(text, text, date, date, text) TO authenticated;

-- Also ensure an INSERT RLS policy exists so owner can insert directly as fallback
DROP POLICY IF EXISTS "Owners can insert their projects" ON public.projects;
CREATE POLICY "Owners can insert their projects"
  ON public.projects FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());