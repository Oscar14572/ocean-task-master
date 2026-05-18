import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type InvitationWithProject = Tables<"project_invitations"> & {
  project: { id: string; name: string } | null;
};

export function useMyInvitations(userId: string | undefined) {
  return useQuery({
    queryKey: ["my-invitations", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_invitations")
        .select("*, project:projects(id, name)")
        .eq("invited_user_id", userId!)
        .eq("status", "pendiente")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as InvitationWithProject[];
    },
  });
}

export function useProjectInvitations(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project-invitations", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_invitations")
        .select("*")
        .eq("project_id", projectId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateInvitation(projectId: string | undefined, userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { email?: string; username?: string; role: string }) => {
      if (!projectId || !userId) throw new Error("Missing context");
      // Buscar perfil por email/username
      let invitedUserId: string | null = null;
      let resolvedEmail: string | null = input.email?.trim().toLowerCase() ?? null;
      let resolvedUsername: string | null = input.username?.trim() ?? null;

      if (resolvedEmail || resolvedUsername) {
        const q = supabase.from("users_profile").select("user_id, email, username");
        const filter = resolvedEmail
          ? q.eq("email", resolvedEmail)
          : q.eq("username", resolvedUsername!);
        const { data: profile } = await filter.maybeSingle();
        if (profile) {
          invitedUserId = profile.user_id;
          resolvedEmail = profile.email ?? resolvedEmail;
          resolvedUsername = profile.username ?? resolvedUsername;
        }
      }

      if (!invitedUserId && !resolvedEmail) {
        throw new Error("Indica un correo o nombre de usuario");
      }

      const { error } = await supabase.from("project_invitations").insert({
        project_id: projectId,
        invited_user_id: invitedUserId,
        invited_email: resolvedEmail,
        invited_username: resolvedUsername,
        role: input.role,
        status: "pendiente",
        invited_by: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-invitations", projectId] }),
  });
}

export function useRespondInvitation(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      invitation,
      accept,
    }: {
      invitation: InvitationWithProject;
      accept: boolean;
    }) => {
      if (!userId) throw new Error("No user");
      const status = accept ? "aceptada" : "rechazada";
      const { error: uErr } = await supabase
        .from("project_invitations")
        .update({ status, responded_at: new Date().toISOString() })
        .eq("id", invitation.id);
      if (uErr) throw uErr;
      if (accept) {
        const { error: mErr } = await supabase.from("project_members").insert({
          project_id: invitation.project_id,
          user_id: userId,
          role: invitation.role,
        });
        if (mErr && !mErr.message.includes("duplicate")) throw mErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-invitations"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useCancelInvitation(projectId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("project_invitations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-invitations", projectId] }),
  });
}
