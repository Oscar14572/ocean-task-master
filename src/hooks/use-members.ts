import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type MemberWithProfile = Tables<"project_members"> & {
  profile: Tables<"users_profile"> | null;
};

export function useMembers(projectId: string | undefined) {
  return useQuery({
    queryKey: ["members", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data: members, error } = await supabase
        .from("project_members")
        .select("*")
        .eq("project_id", projectId!);
      if (error) throw error;
      if (!members?.length) return [] as MemberWithProfile[];
      const ids = members.map((m) => m.user_id);
      const { data: profiles } = await supabase
        .from("users_profile")
        .select("*")
        .in("user_id", ids);
      const map = new Map((profiles ?? []).map((p) => [p.user_id, p]));
      return members.map((m) => ({ ...m, profile: map.get(m.user_id) ?? null }));
    },
  });
}

export function useUpdateMemberRole(projectId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: string }) => {
      const { error } = await supabase
        .from("project_members")
        .update({ role })
        .eq("id", memberId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["members", projectId] }),
  });
}

export function useRemoveMember(projectId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase.from("project_members").delete().eq("id", memberId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["members", projectId] }),
  });
}
