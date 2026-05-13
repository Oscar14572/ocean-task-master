import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useTasks } from "@/hooks/use-tasks";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail, Calendar, LogOut, ListTodo, CheckCircle2, Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Perfil — Aqua Tasks" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: tasks = [] } = useTasks(user?.id);

  const stats = {
    total: tasks.length,
    completed: tasks.filter((t) => t.status === "completada").length,
    inProgress: tasks.filter((t) => t.status === "en progreso").length,
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Sesión cerrada");
    navigate({ to: "/login" });
  };

  const initial = user?.email?.[0]?.toUpperCase() ?? "?";

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-3xl">
      <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">Perfil</h1>
      <p className="text-muted-foreground mb-8">Información de tu cuenta y resumen de actividad.</p>

      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="h-32" style={{ backgroundImage: "var(--gradient-hero)" }} />
        <div className="p-6 -mt-12">
          <div className="flex items-end gap-4 mb-6">
            <div className="h-24 w-24 rounded-2xl flex items-center justify-center text-3xl font-bold text-primary-foreground border-4 border-card shadow-lg"
              style={{ backgroundImage: "var(--gradient-primary)" }}>
              {initial}
            </div>
            <div className="pb-2">
              <h2 className="text-xl font-bold">{user?.email}</h2>
              <p className="text-sm text-muted-foreground">Usuario de Aqua Tasks</p>
            </div>
          </div>

          <dl className="space-y-3">
            <Row icon={Mail} label="Email" value={user?.email ?? ""} />
            <Row icon={Calendar} label="Miembro desde" value={user?.created_at ? new Date(user.created_at).toLocaleDateString() : ""} />
          </dl>

          <button onClick={handleLogout}
            className="mt-6 w-full md:w-auto inline-flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 text-destructive px-4 py-2.5 text-sm font-medium hover:bg-destructive/10 transition">
            <LogOut className="h-4 w-4" /> Cerrar sesión
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mt-6">
        <MiniStat icon={ListTodo} label="Total" value={stats.total} />
        <MiniStat icon={Clock} label="En progreso" value={stats.inProgress} />
        <MiniStat icon={CheckCircle2} label="Completadas" value={stats.completed} />
      </div>
    </div>
  );
}

function Row({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-muted/40 p-3">
      <div className="h-9 w-9 rounded-md bg-primary/10 text-primary flex items-center justify-center"><Icon className="h-4 w-4" /></div>
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="font-medium truncate">{value}</dd>
      </div>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 text-center" style={{ backgroundImage: "var(--gradient-card)" }}>
      <Icon className="h-4 w-4 text-primary mx-auto" />
      <p className="text-2xl font-bold mt-1">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
