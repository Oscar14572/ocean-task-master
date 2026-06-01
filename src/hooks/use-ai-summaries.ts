import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { generateDailySummary, AI_KINDS } from "@/lib/ai-summary.functions";
import type { Tables } from "@/integrations/supabase/types";

export type AiSummary = Tables<"daily_ai_summaries">;
export type AiKind = (typeof AI_KINDS)[number];

export function useAiSummaries(projectId: string | undefined) {
  return useQuery({
    queryKey: ["ai-summaries", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_ai_summaries")
        .select("*")
        .eq("project_id", projectId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as AiSummary[];
    },
  });
}

export function useGenerateSummary(projectId: string | undefined) {
  const qc = useQueryClient();
  const generate = useServerFn(generateDailySummary);
  return useMutation({
    mutationFn: async (input: { kind: AiKind; taskId?: string }) => {
      if (!projectId) throw new Error("Proyecto no disponible");
      return await generate({ data: { projectId, kind: input.kind, taskId: input.taskId } });
    },
    onSuccess: (res) => {
      if (res?.saved) qc.invalidateQueries({ queryKey: ["ai-summaries", projectId] });
    },
  });
}
