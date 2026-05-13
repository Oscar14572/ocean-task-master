import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Task = Tables<"tasks">;
export type TaskStatus = "pendiente" | "en progreso" | "completada";
export type TaskPriority = "baja" | "media" | "alta";

export function useTasks(userId: string | undefined) {
  return useQuery({
    queryKey: ["tasks", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Task[];
    },
  });
}

export function useCreateTask(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<TablesInsert<"tasks">, "user_id">) => {
      if (!userId) throw new Error("No user");
      const { data, error } = await supabase
        .from("tasks")
        .insert({ ...input, user_id: userId })
        .select()
        .single();
      if (error) throw error;
      return data as Task;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks", userId] }),
  });
}

export function useUpdateTask(userId: string | undefined) {
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks", userId] }),
  });
}

export function useDeleteTask(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks", userId] }),
  });
}
