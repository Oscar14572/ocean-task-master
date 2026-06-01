import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useProject, useUpdateProject, useDeleteProject } from "@/hooks/use-projects";
import { useTasks, useCreateTask, useUpdateTask, useDeleteTask, type Task } from "@/hooks/use-tasks";
import { useMembers, useUpdateMemberRole, useRemoveMember } from "@/hooks/use-members";
import { useCreateInvitation, useProjectInvitations, useCancelInvitation } from "@/hooks/use-invitations";
import { useProjectComments, useCreateComment, useDeleteComment } from "@/hooks/use-task-comments";
import { useAiSummaries } from "@/hooks/use-ai-summaries";
import { AiPanel } from "@/components/AiPanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { StatusBadge, PriorityBadge } from "@/components/StatusBadge";
import { GanttChart } from "@/components/GanttChart";
import { TaskDialog } from "@/components/TaskDialog";
import { InviteDialog } from "@/components/InviteDialog";
import {
  ArrowLeft, Calendar, CheckCircle2, Clock, Loader2, Plus, Sparkles,
  Trash2, UserPlus, Users, AlertTriangle, ListChecks, KanbanSquare, MessageSquare, Settings, Copy, RefreshCw
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/projects/$projectId")({
  component: ProjectDetailPage,
});

const today = () => new Date().toISOString().slice(0, 10);

function ProjectDetailPage() {
  const { projectId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: project, isLoading } = useProject(projectId);
  const { data: tasks } = useTasks(projectId);
  const { data: members } = useMembers(projectId);
  const { data: invitations } = useProjectInvitations(projectId);
  const { data: comments } = useProjectComments(projectId);
  const { data: summaries } = useAiSummaries(projectId);

  const updateProject = useUpdateProject(projectId);
  const deleteProject = useDeleteProject();
  const createTask = useCreateTask(projectId, user?.id);
  const updateTask = useUpdateTask(projectId);
  const deleteTask = useDeleteTask(projectId);
  const updateRole = useUpdateMemberRole(projectId);
  const removeMember = useRemoveMember(projectId);
  const createInvite = useCreateInvitation(projectId, user?.id);
  const cancelInvite = useCancelInvitation(projectId);
  const createComment = useCreateComment(projectId, user?.id);
  const deleteComment = useDeleteComment(projectId);
  const generate = useGenerateSummary(projectId);

  const [taskOpen, setTaskOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [view, setView] = useState<"gantt" | "list" | "calendar">("gantt");
  const [groupBy, setGroupBy] = useState<"status" | "priority" | "assignee">("status");

  const myMembership = members?.find((m) => m.user_id === user?.id);
  const isOwner = project?.owner_id === user?.id;
  const isAdmin = isOwner || myMembership?.role === "admin";
  const canEdit = isAdmin || myMembership?.role === "colaborador";

  const assigneeNames = useMemo(() => {
    const map = new Map<string, string>();
    members?.forEach((m) => {
      if (m.user_id) map.set(m.user_id, m.profile?.full_name || m.profile?.username || m.profile?.email || "Usuario");
    });
    return map;
  }, [members]);

  const stats = useMemo(() => {
    const list = tasks ?? [];
    const todayStr = today();
    const total = list.length;
    const pending = list.filter((t) => t.status === "pendiente").length;
    const inProgress = list.filter((t) => t.status === "en_progreso").length;
    const done = list.filter((t) => t.status === "completada").length;
    const overdue = list.filter((t) => t.end_date < todayStr && t.status !== "completada").length;
    const upcoming = list.filter((t) => {
      const diff = (new Date(t.end_date).getTime() - new Date(todayStr).getTime()) / 86400000;
      return diff >= 0 && diff <= 3 && t.status !== "completada";
    }).length;
    const avg = total ? Math.round(list.reduce((a, t) => a + t.progress, 0) / total) : 0;
    return { total, pending, inProgress, done, overdue, upcoming, avg };
  }, [tasks]);

  if (isLoading || !project) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const submitTask = async (v: Parameters<Parameters<typeof TaskDialog>[0]["onSubmit"]>[0]) => {
    if (v.id) {
      await updateTask.mutateAsync({ id: v.id, ...v });
      toast.success("Tarea actualizada");
    } else {
      await createTask.mutateAsync(v);
      toast.success("Tarea creada");
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/dashboard" })}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Volver
        </Button>
      </div>

      {/* Header */}
      <header className="bg-gradient-to-br from-primary/10 via-card to-card border rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl md:text-3xl font-bold">{project.name}</h1>
              <StatusBadge status={project.status} />
              {isAdmin && <Badge variant="outline" className="capitalize">Tu rol: admin</Badge>}
            </div>
            <p className="text-muted-foreground max-w-2xl">{project.description || "Sin descripción"}</p>
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {project.start_date} → {project.end_date}</span>
              <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {members?.length ?? 0} miembros</span>
              <span className="flex items-center gap-1"><ListChecks className="h-3 w-3" /> {stats.total} tareas</span>
            </div>
          </div>
          <div className="min-w-[200px] space-y-2">
            <div className="text-xs text-muted-foreground">Progreso general</div>
            <Progress value={stats.avg} className="h-3" />
            <div className="text-2xl font-bold text-primary">{stats.avg}%</div>
          </div>
        </div>
      </header>

      <Tabs defaultValue="resumen" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="planificacion">Calendario / Gantt</TabsTrigger>
          <TabsTrigger value="tareas">Tareas</TabsTrigger>
          <TabsTrigger value="miembros">Miembros</TabsTrigger>
          <TabsTrigger value="avances">Avances</TabsTrigger>
          <TabsTrigger value="ia">Resumen IA</TabsTrigger>
          {isAdmin && <TabsTrigger value="config">Configuración</TabsTrigger>}
        </TabsList>

        {/* RESUMEN */}
        <TabsContent value="resumen" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={<ListChecks />} label="Total" value={stats.total} />
            <StatCard icon={<Clock />} label="Pendientes" value={stats.pending} />
            <StatCard icon={<KanbanSquare />} label="En progreso" value={stats.inProgress} accent />
            <StatCard icon={<CheckCircle2 />} label="Completadas" value={stats.done} />
            <StatCard icon={<AlertTriangle />} label="Vencidas" value={stats.overdue} danger />
            <StatCard icon={<Clock />} label="Próximas a vencer" value={stats.upcoming} warning />
            <StatCard icon={<Users />} label="Miembros" value={members?.length ?? 0} />
            <StatCard icon={<Sparkles />} label="Resúmenes IA" value={summaries?.length ?? 0} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Últimos avances</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 max-h-80 overflow-y-auto">
                {!comments?.length && <p className="text-sm text-muted-foreground">Aún no hay avances reportados.</p>}
                {comments?.slice(0, 5).map((c) => (
                  <div key={c.id} className="border-l-2 border-primary pl-3 py-1">
                    <div className="text-xs text-muted-foreground flex justify-between">
                      <span>{c.profile?.full_name ?? c.profile?.username ?? "Usuario"}</span>
                      <span>{new Date(c.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-sm">{c.comment}</p>
                    {c.task && <p className="text-xs text-primary">📌 {c.task.title}</p>}
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Miembros activos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-80 overflow-y-auto">
                {members?.map((m) => (
                  <div key={m.id} className="flex items-center justify-between text-sm py-1">
                    <div>
                      <div className="font-medium">{m.profile?.full_name || m.profile?.username || "Usuario"}</div>
                      <div className="text-xs text-muted-foreground">{m.profile?.email}</div>
                    </div>
                    <Badge variant="outline" className="capitalize">{m.role}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* PLANIFICACION (Gantt/Calendar/List view selector) */}
        <TabsContent value="planificacion" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Tabs value={view} onValueChange={(v) => setView(v as "gantt" | "list" | "calendar")}>
                <TabsList>
                  <TabsTrigger value="gantt">Gantt</TabsTrigger>
                  <TabsTrigger value="calendar">Calendario</TabsTrigger>
                  <TabsTrigger value="list">Lista</TabsTrigger>
                </TabsList>
              </Tabs>
              <Select value={groupBy} onValueChange={(v) => setGroupBy(v as typeof groupBy)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="status">Agrupar por estado</SelectItem>
                  <SelectItem value="priority">Agrupar por prioridad</SelectItem>
                  <SelectItem value="assignee">Agrupar por responsable</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {canEdit && (
              <Button onClick={() => { setEditTask(null); setTaskOpen(true); }}>
                <Plus className="h-4 w-4 mr-1" /> Nueva tarea
              </Button>
            )}
          </div>
          {view === "gantt" && (
            <GanttChart
              tasks={tasks ?? []}
              groupBy={groupBy}
              assigneeNames={assigneeNames}
              onSelect={(t) => { setEditTask(t); setTaskOpen(true); }}
            />
          )}
          {view === "list" && (
            <TaskListView tasks={tasks ?? []} onEdit={(t) => { setEditTask(t); setTaskOpen(true); }} assigneeNames={assigneeNames} />
          )}
          {view === "calendar" && (
            <CalendarView tasks={tasks ?? []} onSelect={(t) => { setEditTask(t); setTaskOpen(true); }} />
          )}
        </TabsContent>

        {/* TAREAS */}
        <TabsContent value="tareas" className="space-y-4">
          {canEdit && (
            <div className="flex justify-end">
              <Button onClick={() => { setEditTask(null); setTaskOpen(true); }}>
                <Plus className="h-4 w-4 mr-1" /> Nueva tarea
              </Button>
            </div>
          )}
          <TaskListView tasks={tasks ?? []} onEdit={(t) => { setEditTask(t); setTaskOpen(true); }} assigneeNames={assigneeNames} />
        </TabsContent>

        {/* MIEMBROS */}
        <TabsContent value="miembros" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Equipo del proyecto</h3>
            {isAdmin && (
              <Button onClick={() => setInviteOpen(true)}>
                <UserPlus className="h-4 w-4 mr-1" /> Invitar miembro
              </Button>
            )}
          </div>
          <Card>
            <CardContent className="divide-y p-0">
              {members?.map((m) => (
                <div key={m.id} className="flex items-center justify-between p-4">
                  <div className="flex-1">
                    <div className="font-medium">{m.profile?.full_name || m.profile?.username || "Usuario"}</div>
                    <div className="text-xs text-muted-foreground">{m.profile?.email}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Desde {new Date(m.joined_at).toLocaleDateString()} ·{" "}
                      {tasks?.filter((t) => t.main_assignee_id === m.user_id).length ?? 0} tareas
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isAdmin && m.user_id !== project.owner_id ? (
                      <>
                        <Select
                          value={m.role}
                          onValueChange={(v) =>
                            updateRole.mutate({ memberId: m.id, role: v }, { onSuccess: () => toast.success("Rol actualizado") })
                          }
                        >
                          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Administrador</SelectItem>
                            <SelectItem value="colaborador">Colaborador</SelectItem>
                            <SelectItem value="observador">Observador</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm("¿Remover miembro?"))
                              removeMember.mutate(m.id, { onSuccess: () => toast.success("Miembro removido") });
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    ) : (
                      <Badge variant="outline" className="capitalize">{m.role}{m.user_id === project.owner_id ? " · dueño" : ""}</Badge>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {isAdmin && invitations && invitations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Invitaciones</CardTitle>
              </CardHeader>
              <CardContent className="divide-y p-0">
                {invitations.map((i) => (
                  <div key={i.id} className="flex items-center justify-between p-3">
                    <div className="text-sm">
                      <div>{i.invited_email || i.invited_username}</div>
                      <div className="text-xs text-muted-foreground capitalize">{i.role} · {i.status}</div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => cancelInvite.mutate(i.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* AVANCES */}
        <TabsContent value="avances" className="space-y-4">
          <CommentComposer
            tasks={tasks ?? []}
            onSubmit={async (input) => {
              await createComment.mutateAsync(input);
              toast.success("Avance publicado");
            }}
            onUpdateTaskProgress={async (taskId, progress) => {
              await updateTask.mutateAsync({ id: taskId, progress });
            }}
            canPost={!!myMembership}
          />
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4" /> Historial de avances
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[600px] overflow-y-auto">
              {!comments?.length && <p className="text-sm text-muted-foreground">Sin avances aún.</p>}
              {comments?.map((c) => {
                const isBloqueo = c.type === "bloqueo";
                return (
                <div
                  key={c.id}
                  className={`border rounded-lg p-3 ${isBloqueo ? "bg-destructive/10 border-destructive/40" : "bg-card"}`}
                >
                  <div className="flex items-start justify-between text-xs text-muted-foreground mb-1">
                    <div className="font-semibold text-foreground flex items-center gap-2">
                      {isBloqueo && <AlertTriangle className="h-4 w-4 text-destructive" />}
                      {c.profile?.full_name || c.profile?.username || "Usuario"}
                      {isBloqueo && <Badge variant="destructive" className="text-[10px]">Bloqueo</Badge>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span>{new Date(c.created_at).toLocaleString()}</span>
                      {(isAdmin || c.user_id === user?.id) && (
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteComment.mutate(c.id)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                  {c.task && <Badge variant="outline" className="mb-2 text-xs">📌 {c.task.title}</Badge>}
                  <p className="text-sm whitespace-pre-wrap">{c.comment}</p>
                  {c.progress_reported != null && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-primary">
                      <span>Progreso reportado: {c.progress_reported}%</span>
                      <Progress value={c.progress_reported} className="h-1 flex-1" />
                    </div>
                  )}
                </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        {/* IA */}
        <TabsContent value="ia" className="space-y-4">
          <AiPanel
            projectId={projectId}
            tasks={tasks ?? []}
            isAdmin={!!isAdmin}
            hasComments={!!comments?.length}
          />
        </TabsContent>


        {/* CONFIG */}
        {isAdmin && (
          <TabsContent value="config" className="space-y-4">
            <ConfigPanel
              project={project}
              onSave={(v) =>
                updateProject.mutate(v, { onSuccess: () => toast.success("Proyecto actualizado") })
              }
              onDelete={() => {
                if (confirm("¿Eliminar el proyecto? Esta acción es irreversible.")) {
                  deleteProject.mutate(project.id, {
                    onSuccess: () => {
                      toast.success("Proyecto eliminado");
                      navigate({ to: "/dashboard" });
                    },
                  });
                }
              }}
            />
          </TabsContent>
        )}
      </Tabs>

      <TaskDialog
        open={taskOpen}
        onOpenChange={setTaskOpen}
        initial={editTask}
        members={members ?? []}
        canEdit={!!canEdit}
        isAdmin={isAdmin}
        projectId={projectId}
        projectName={project.name}
        projectStart={project.start_date}
        projectEnd={project.end_date}
        currentUserId={user?.id}
        onSubmit={submitTask}
        onUpdateProgress={async (id, progress) => {
          await updateTask.mutateAsync({ id, progress });
          toast.success("Progreso actualizado");
        }}
        onDelete={async (id) => {
          await deleteTask.mutateAsync(id);
          toast.success("Tarea eliminada");
        }}
      />
      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onInvite={async (input) => {
          await createInvite.mutateAsync(input);
        }}
      />
    </div>
  );
}

function StatCard({
  icon, label, value, accent, danger, warning,
}: { icon: React.ReactNode; label: string; value: number; accent?: boolean; danger?: boolean; warning?: boolean }) {
  return (
    <Card className={accent ? "border-primary/40" : danger ? "border-destructive/40" : warning ? "border-warning/40" : ""}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2 rounded-lg ${danger ? "bg-destructive/10 text-destructive" : warning ? "bg-warning/15 text-warning-foreground" : accent ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
          {icon}
        </div>
        <div>
          <div className="text-2xl font-bold leading-tight">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function TaskListView({
  tasks, onEdit, assigneeNames,
}: { tasks: Task[]; onEdit: (t: Task) => void; assigneeNames: Map<string, string> }) {
  const todayStr = today();
  if (!tasks.length)
    return <Card><CardContent className="py-12 text-center text-muted-foreground">No hay tareas. Crea la primera.</CardContent></Card>;
  return (
    <Card>
      <CardContent className="divide-y p-0">
        {tasks.map((t) => {
          const overdue = t.end_date < todayStr && t.status !== "completada";
          return (
            <button
              key={t.id}
              className="w-full text-left p-4 hover:bg-muted/30 flex items-center gap-4"
              onClick={() => onEdit(t)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium truncate">{t.title}</span>
                  <StatusBadge status={t.status} />
                  <PriorityBadge priority={t.priority} />
                  {overdue && <Badge variant="destructive" className="text-xs">Vencida</Badge>}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {t.start_date} → {t.end_date} · {t.main_assignee_id ? assigneeNames.get(t.main_assignee_id) : "Sin responsable"}
                </div>
              </div>
              <div className="w-32 shrink-0">
                <Progress value={t.progress} className="h-2" />
                <div className="text-xs text-right text-muted-foreground mt-1">{t.progress}%</div>
              </div>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}

function CalendarView({ tasks, onSelect }: { tasks: Task[]; onSelect: (t: Task) => void }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const daysInMonth = last.getDate();
  const startWeekday = first.getDay();
  const cells: Array<{ day: number | null; date: string }> = [];
  for (let i = 0; i < startWeekday; i++) cells.push({ day: null, date: "" });
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ day: d, date });
  }
  const monthName = first.toLocaleDateString("es", { month: "long", year: "numeric" });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="capitalize">{monthName}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1 text-xs">
          {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map((d) => (
            <div key={d} className="text-center font-semibold text-muted-foreground py-1">{d}</div>
          ))}
          {cells.map((c, i) => {
            const dayTasks = c.date ? tasks.filter((t) => t.start_date <= c.date && c.date <= t.end_date) : [];
            const isToday = c.date === today();
            return (
              <div
                key={i}
                className={`min-h-[90px] border rounded p-1 ${isToday ? "border-primary bg-primary/5" : "border-border/40"} ${!c.day ? "opacity-30" : ""}`}
              >
                {c.day && <div className="text-[10px] font-semibold mb-1">{c.day}</div>}
                <div className="space-y-0.5">
                  {dayTasks.slice(0, 3).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => onSelect(t)}
                      className="w-full text-[9px] text-left px-1 py-0.5 rounded bg-primary/15 text-primary truncate hover:bg-primary/25"
                    >
                      {t.title}
                    </button>
                  ))}
                  {dayTasks.length > 3 && <div className="text-[9px] text-muted-foreground">+{dayTasks.length - 3} más</div>}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function CommentComposer({
  tasks, onSubmit, onUpdateTaskProgress, canPost,
}: {
  tasks: Task[];
  onSubmit: (input: { task_id: string; comment: string; progress_reported: number; type: string }) => Promise<void>;
  onUpdateTaskProgress: (taskId: string, progress: number) => Promise<void>;
  canPost: boolean;
}) {
  const [taskId, setTaskId] = useState("");
  const [text, setText] = useState("");
  const [progress, setProgress] = useState(0);
  const [type, setType] = useState("avance");
  const [syncTask, setSyncTask] = useState(true);

  if (!canPost) return <p className="text-sm text-muted-foreground">Solo los miembros del proyecto pueden reportar avances.</p>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Reportar avance</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <Label>Tarea</Label>
            <Select value={taskId} onValueChange={setTaskId}>
              <SelectTrigger><SelectValue placeholder="Selecciona una tarea" /></SelectTrigger>
              <SelectContent>
                {tasks.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tipo</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="avance">Avance</SelectItem>
                <SelectItem value="bloqueo">Bloqueo</SelectItem>
                <SelectItem value="nota">Nota</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label>Comentario</Label>
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="¿Qué avanzaste? ¿Hay bloqueos?" maxLength={2000} />
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <Label>Avance reportado: {progress}%</Label>
            <Input type="number" min={0} max={100} value={progress} onChange={(e) => setProgress(Number(e.target.value))} />
          </div>
          <div className="flex items-end gap-2">
            <Switch checked={syncTask} onCheckedChange={setSyncTask} id="sync" />
            <Label htmlFor="sync" className="cursor-pointer">Actualizar progreso de la tarea</Label>
          </div>
        </div>
        <Button
          onClick={async () => {
            if (!taskId) return toast.error("Selecciona una tarea");
            if (!text.trim()) return toast.error("Escribe un comentario");
            try {
              await onSubmit({ task_id: taskId, comment: text.trim(), progress_reported: progress, type });
              if (syncTask) await onUpdateTaskProgress(taskId, progress);
              setText("");
              setProgress(0);
            } catch (e) {
              toast.error((e as Error).message);
            }
          }}
        >
          <MessageSquare className="h-4 w-4 mr-2" /> Publicar avance
        </Button>
      </CardContent>
    </Card>
  );
}

function ConfigPanel({
  project, onSave, onDelete,
}: {
  project: ReturnType<typeof useProject>["data"] extends infer T ? NonNullable<T> : never;
  onSave: (v: { name: string; description: string | null; status: string; start_date: string; end_date: string; access_code: string | null; access_code_enabled: boolean }) => void;
  onDelete: () => void;
}) {
  const [form, setForm] = useState({
    name: project.name,
    description: project.description ?? "",
    status: project.status,
    start_date: project.start_date,
    end_date: project.end_date,
    access_code: project.access_code ?? "",
    access_code_enabled: project.access_code_enabled,
  });

  const generateCode = () => {
    const code = Math.random().toString(36).slice(2, 10).toUpperCase();
    setForm({ ...form, access_code: code });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Datos del proyecto</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Nombre</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>Descripción</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <Label>Estado</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="planificacion">Planificación</SelectItem>
                  <SelectItem value="en_progreso">En progreso</SelectItem>
                  <SelectItem value="pausado">Pausado</SelectItem>
                  <SelectItem value="completado">Completado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Fecha inicio</Label>
              <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            </div>
            <div>
              <Label>Fecha fin</Label>
              <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Clave de acceso</CardTitle>
          <CardDescription>Permite que otros usuarios se unan al proyecto usando esta clave.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Switch
              checked={form.access_code_enabled}
              onCheckedChange={(v) => setForm({ ...form, access_code_enabled: v })}
              id="acen"
            />
            <Label htmlFor="acen">Habilitar unión por clave</Label>
          </div>
          <div className="flex gap-2">
            <Input value={form.access_code} onChange={(e) => setForm({ ...form, access_code: e.target.value.toUpperCase() })} placeholder="Ej: AQUA-1234" />
            <Button variant="outline" onClick={generateCode}><RefreshCw className="h-4 w-4" /></Button>
            <Button
              variant="outline"
              onClick={() => {
                if (!form.access_code) return;
                navigator.clipboard.writeText(form.access_code);
                toast.success("Clave copiada");
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="destructive" onClick={onDelete}><Trash2 className="h-4 w-4 mr-1" /> Eliminar proyecto</Button>
        <Button
          onClick={() =>
            onSave({
              name: form.name.trim(),
              description: form.description.trim() || null,
              status: form.status,
              start_date: form.start_date,
              end_date: form.end_date,
              access_code: form.access_code.trim() || null,
              access_code_enabled: form.access_code_enabled,
            })
          }
        >
          <Settings className="h-4 w-4 mr-1" /> Guardar cambios
        </Button>
      </div>
    </div>
  );
}
