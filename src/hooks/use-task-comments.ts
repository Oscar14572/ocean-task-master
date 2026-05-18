import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type ProgressComment = Tables<"task_progress_comments"> & {
  profile: Tables<"users_profile"> | null;
  task: { id: string; title: string } | null;
};

export function useProjectComments(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project-comments", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_progress_comments")
        .select("*, task:tasks(id, title)")
        .eq("project_id", projectId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const ids = Array.from(new Set((data ?? []).map((c) => c.user_id)));
      const { data: profiles } = ids.length
        ? await supabase.from("users_profile").select("*").in("user_id", ids)
        : { data: [] };
      const map = new Map((profiles ?? []).map((p) => [p.user_id, p]));
      return (data ?? []).map((c) => ({ ...c, profile: map.get(c.user_id) ?? null })) as ProgressComment[];
    },
  });
}

export function useTaskComments(taskId: string | undefined) {
  return useQuery({
    queryKey: ["task-comments", taskId],
    enabled: !!taskId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_progress_comments")
        .select("*")
        .eq("task_id", taskId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateComment(projectId: string | undefined, userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<TablesInsert<"task_progress_comments">, "user_id" | "project_id">) => {
      if (!projectId || !userId) throw new Error("Missing context");
      const { error } = await supabase
        .from("task_progress_comments")
        .insert({ ...input, project_id: projectId, user_id: userId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-comments", projectId] });
      qc.invalidateQueries({ queryKey: ["task-comments"] });
    },
  });
}

export function useDeleteComment(projectId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("task_progress_comments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-comments", projectId] }),
  });
}
