-- Create task_subtasks table for task checklists
CREATE TABLE IF NOT EXISTS task_subtasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on task_subtasks
ALTER TABLE task_subtasks ENABLE ROW LEVEL SECURITY;

-- Subtasks: Users can view subtasks of tasks in projects they're members of
CREATE POLICY "Users can view subtasks of projects they're in"
  ON task_subtasks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_subtasks.task_id
      AND EXISTS (
        SELECT 1 FROM project_members pm
        WHERE pm.project_id = t.project_id
        AND pm.user_id = auth.uid()
      )
    )
  );

-- Subtasks: Admins can create subtasks
CREATE POLICY "Admins can create subtasks"
  ON task_subtasks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_subtasks.task_id
      AND EXISTS (
        SELECT 1 FROM project_members pm
        WHERE pm.project_id = t.project_id
        AND pm.user_id = auth.uid()
        AND pm.role = 'administrador'
      )
    )
  );

-- Subtasks: Admins and assigned users can update subtasks
CREATE POLICY "Subtask creators and admins can update"
  ON task_subtasks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_subtasks.task_id
      AND EXISTS (
        SELECT 1 FROM project_members pm
        WHERE pm.project_id = t.project_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('administrador', 'colaborador')
      )
    )
  );

-- Subtasks: Admins can delete subtasks
CREATE POLICY "Admins can delete subtasks"
  ON task_subtasks FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_subtasks.task_id
      AND EXISTS (
        SELECT 1 FROM project_members pm
        WHERE pm.project_id = t.project_id
        AND pm.user_id = auth.uid()
        AND pm.role = 'administrador'
      )
    )
  );

-- Create index for faster queries
CREATE INDEX idx_task_subtasks_task_id ON task_subtasks(task_id);
