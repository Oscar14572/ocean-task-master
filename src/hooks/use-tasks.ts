import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Task = Tables<"tasks">;
export type TaskStatus = "pendiente" | "en_progreso" | "en_revision" | "completada";
export type TaskPriority = "baja" | "media" | "alta" | "critica";

export function useTasks(projectId: string | undefined) {
  return useQuery({
    queryKey: ["tasks", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("project_id", projectId!)
        .order("start_date", { ascending: true });
      if (error) throw error;
      return data as Task[];
    },
  });
}

export function useCreateTask(projectId: string | undefined, userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<TablesInsert<"tasks">, "project_id" | "created_by">) => {
      if (!projectId || !userId) throw new Error("Missing context");
      const { data, error } = await supabase
        .from("tasks")
        .insert({ ...input, project_id: projectId, created_by: userId })
        .select()
        .single();
      if (error) throw error;
      return data as Task;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks", projectId] }),
  });
}

export function useUpdateTask(projectId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & TablesUpdate<"tasks">) => {
      const { data, error } = await supabase
        .from("tasks")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Task;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks", projectId] }),
  });
}

export function useDeleteTask(projectId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks", projectId] }),
  });
}
