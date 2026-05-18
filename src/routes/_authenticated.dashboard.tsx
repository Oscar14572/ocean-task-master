import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useMyProjects } from "@/hooks/use-projects";
import { useMyInvitations, useRespondInvitation } from "@/hooks/use-invitations";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { Plus, KeyRound, FolderKanban, Bell, Loader2, Inbox, Calendar } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: projects, isLoading } = useMyProjects(user?.id);
  const { data: invitations } = useMyInvitations(user?.id);
  const respond = useRespondInvitation(user?.id);

  const name = user?.email?.split("@")[0] ?? "amigo";

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Bienvenido de vuelta</p>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight capitalize">
            Hola, {name} 👋
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestiona tus proyectos colaborativos en Ocean Task Master.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate({ to: "/projects/new" })} className="gap-2">
            <Plus className="h-4 w-4" /> Crear proyecto
          </Button>
          <Button variant="outline" onClick={() => navigate({ to: "/projects/join" })} className="gap-2">
            <KeyRound className="h-4 w-4" /> Unirme
          </Button>
        </div>
      </header>

      {invitations && invitations.length > 0 && (
        <Card className="border-primary/40 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Bell className="h-5 w-5 text-primary" />
              Tienes {invitations.length} invitación{invitations.length === 1 ? "" : "es"} pendiente{invitations.length === 1 ? "" : "s"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {invitations.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-card border">
                <div className="text-sm">
                  Has sido invitado a colaborar en <span className="font-semibold">{inv.project?.name ?? "—"}</span> con el rol <span className="font-semibold capitalize">{inv.role}</span>.
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    size="sm"
                    onClick={() =>
                      respond.mutate(
                        { invitation: inv, accept: true },
                        {
                          onSuccess: () => toast.success("Invitación aceptada"),
                          onError: (e: Error) => toast.error(e.message),
                        },
                      )
                    }
                  >
                    Aceptar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      respond.mutate(
                        { invitation: inv, accept: false },
                        { onSuccess: () => toast.info("Invitación rechazada") },
                      )
                    }
                  >
                    Rechazar
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <section>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <FolderKanban className="h-5 w-5 text-primary" />
          Mis proyectos
        </h2>
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : !projects || projects.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 flex flex-col items-center text-center gap-3">
              <Inbox className="h-10 w-10 text-muted-foreground" />
              <p className="text-muted-foreground">Aún no perteneces a ningún proyecto.</p>
              <div className="flex gap-2">
                <Button onClick={() => navigate({ to: "/projects/new" })}>Crear mi primer proyecto</Button>
                <Button variant="outline" onClick={() => navigate({ to: "/projects/join" })}>Unirme con clave</Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <Link key={p.id} to="/projects/$projectId" params={{ projectId: p.id }}>
                <Card className="hover:shadow-lg hover:border-primary/40 transition-all cursor-pointer h-full">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-lg line-clamp-1">{p.name}</CardTitle>
                      <StatusBadge status={p.status} />
                    </div>
                    <CardDescription className="line-clamp-2">
                      {p.description || "Sin descripción"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {p.start_date} → {p.end_date}
                    </span>
                    <span className="capitalize font-medium text-primary">{p.role}</span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
