import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Project = Tables<"projects">;
export type ProjectMember = Tables<"project_members">;
export type ProjectStatus = "planificacion" | "en_progreso" | "pausado" | "completado";
export type ProjectRole = "admin" | "colaborador" | "observador";

export function useMyProjects(userId: string | undefined) {
  return useQuery({
    queryKey: ["projects", "mine", userId],
    enabled: !!userId,
    queryFn: async () => {
      // Trae proyectos donde el user es miembro (incluye dueños vía trigger)
      const { data: memberships, error: mErr } = await supabase
        .from("project_members")
        .select("project_id, role")
        .eq("user_id", userId!);
      if (mErr) throw mErr;
      if (!memberships?.length) return [] as Array<Project & { role: ProjectRole }>;
      const ids = memberships.map((m) => m.project_id);
      const { data: projects, error: pErr } = await supabase
        .from("projects")
        .select("*")
        .in("id", ids)
        .order("updated_at", { ascending: false });
      if (pErr) throw pErr;
      const roleMap = new Map(memberships.map((m) => [m.project_id, m.role as ProjectRole]));
      return (projects ?? []).map((p) => ({ ...p, role: roleMap.get(p.id) ?? "observador" }));
    },
  });
}

export function useProject(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId!)
        .single();
      if (error) throw error;
      return data as Project;
    },
  });
}

export function useMyRole(projectId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: ["project-role", projectId, userId],
    enabled: !!projectId && !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_members")
        .select("role")
        .eq("project_id", projectId!)
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return (data?.role ?? null) as ProjectRole | null;
    },
  });
}

export function useCreateProject(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<TablesInsert<"projects">, "owner_id">) => {
      if (!userId) throw new Error("No user");
      const { data, error } = await supabase
        .from("projects")
        .insert({ ...input, owner_id: userId })
        .select()
        .single();
      if (error) throw error;
      return data as Project;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useUpdateProject(projectId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: TablesUpdate<"projects">) => {
      const { data, error } = await supabase
        .from("projects")
        .update(patch)
        .eq("id", projectId!)
        .select()
        .single();
      if (error) throw error;
      return data as Project;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projects").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useJoinByCode(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) => {
      if (!userId) throw new Error("No user");
      const { data: project, error } = await supabase
        .from("projects")
        .select("id, name, access_code_enabled")
        .eq("access_code", code.trim())
        .maybeSingle();
      if (error) throw error;
      if (!project || !project.access_code_enabled) {
        throw new Error("Clave inválida o desactivada");
      }
      const { error: mErr } = await supabase
        .from("project_members")
        .insert({ project_id: project.id, user_id: userId, role: "colaborador" });
      if (mErr && !mErr.message.includes("duplicate")) throw mErr;
      return project;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}
