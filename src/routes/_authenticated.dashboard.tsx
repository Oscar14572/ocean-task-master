import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useTasks, useCreateTask, useUpdateTask, useDeleteTask, type Task, type TaskPriority, type TaskStatus } from "@/hooks/use-tasks";
import { toast } from "sonner";
import {
  Plus, Search, Filter, Calendar as CalendarIcon, Trash2, Pencil, CheckCircle2, Circle, Clock,
  ArrowUpDown, Loader2, ListTodo, AlertCircle, Sparkles, X
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Aqua Tasks" }] }),
  component: DashboardPage,
});

const STATUSES: TaskStatus[] = ["pendiente", "en progreso", "completada"];
const PRIORITIES: TaskPriority[] = ["baja", "media", "alta"];

const statusStyles: Record<TaskStatus, string> = {
  "pendiente": "bg-muted text-muted-foreground border-border",
  "en progreso": "bg-accent/15 text-accent border-accent/30",
  "completada": "bg-success/15 text-success border-success/30",
};

const priorityStyles: Record<TaskPriority, string> = {
  baja: "bg-secondary text-secondary-foreground",
  media: "bg-warning/20 text-warning-foreground border border-warning/40",
  alta: "bg-destructive/15 text-destructive border border-destructive/30",
};

function DashboardPage() {
  const { user } = useAuth();
  const userId = user?.id;
  const { data: tasks = [], isLoading } = useTasks(userId);
  const createTask = useCreateTask(userId);
  const updateTask = useUpdateTask(userId);
  const deleteTask = useDeleteTask(userId);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | "all">("all");
  const [sortBy, setSortBy] = useState<"created" | "due" | "priority">("created");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Task | null>(null);

  const stats = useMemo(() => {
    const total = tasks.length;
    const pending = tasks.filter((t) => t.status === "pendiente").length;
    const inProgress = tasks.filter((t) => t.status === "en progreso").length;
    const completed = tasks.filter((t) => t.status === "completada").length;
    const pct = total ? Math.round((completed / total) * 100) : 0;
    return { total, pending, inProgress, completed, pct };
  }, [tasks]);

  const filtered = useMemo(() => {
    const priorityRank: Record<TaskPriority, number> = { alta: 0, media: 1, baja: 2 };
    return tasks
      .filter((t) => {
        if (statusFilter !== "all" && t.status !== statusFilter) return false;
        if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
        if (search.trim()) {
          const q = search.toLowerCase();
          if (!t.title.toLowerCase().includes(q) && !(t.description ?? "").toLowerCase().includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "due") {
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        }
        if (sortBy === "priority") return priorityRank[a.priority as TaskPriority] - priorityRank[b.priority as TaskPriority];
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [tasks, statusFilter, priorityFilter, search, sortBy]);

  const openCreate = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (t: Task) => { setEditing(t); setModalOpen(true); };

  const cycleStatus = async (t: Task) => {
    const next: TaskStatus = t.status === "pendiente" ? "en progreso" : t.status === "en progreso" ? "completada" : "pendiente";
    try {
      await updateTask.mutateAsync({ id: t.id, status: next });
      toast.success(`Tarea marcada como ${next}`);
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deleteTask.mutateAsync(confirmDelete.id);
      toast.success("Tarea eliminada");
      setConfirmDelete(null);
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-7xl">
      <header className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Tu dashboard</h1>
          <p className="mt-1 text-muted-foreground">Organiza, filtra y completa tus tareas en un solo lugar.</p>
        </div>
        <button onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 hover:scale-[1.02]"
          style={{ backgroundImage: "var(--gradient-primary)", boxShadow: "var(--shadow-elegant)" }}>
          <Plus className="h-4 w-4" /> Nueva tarea
        </button>
      </header>

      {/* Stats */}
      <section className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard label="Total" value={stats.total} icon={ListTodo} tone="primary" />
        <StatCard label="Pendientes" value={stats.pending} icon={Circle} tone="muted" />
        <StatCard label="En progreso" value={stats.inProgress} icon={Clock} tone="accent" />
        <StatCard label="Completadas" value={stats.completed} icon={CheckCircle2} tone="success" />
      </section>

      <div className="rounded-2xl border border-border bg-card p-5 mb-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <p className="text-sm font-medium">Progreso del usuario</p>
            <p className="text-xs text-muted-foreground">{stats.completed} de {stats.total} completadas</p>
          </div>
          <span className="text-2xl font-bold text-primary">{stats.pct}%</span>
        </div>
        <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${stats.pct}%`, backgroundImage: "var(--gradient-primary)" }} />
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-border bg-card p-4 mb-6 shadow-sm">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por título o descripción..."
              className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring transition" />
          </div>
          <Select icon={Filter} value={statusFilter} onChange={(v) => setStatusFilter(v as any)}
            options={[{ v: "all", l: "Todos los estados" }, ...STATUSES.map((s) => ({ v: s, l: s }))]} />
          <Select icon={AlertCircle} value={priorityFilter} onChange={(v) => setPriorityFilter(v as any)}
            options={[{ v: "all", l: "Todas las prioridades" }, ...PRIORITIES.map((p) => ({ v: p, l: p }))]} />
          <Select icon={ArrowUpDown} value={sortBy} onChange={(v) => setSortBy(v as any)}
            options={[{ v: "created", l: "Más recientes" }, { v: "due", l: "Por fecha límite" }, { v: "priority", l: "Por prioridad" }]} />
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState onCreate={openCreate} hasTasks={tasks.length > 0} />
      ) : (
        <ul className="grid gap-3">
          {filtered.map((t) => (
            <li key={t.id}
              className="group rounded-xl border border-border bg-card p-4 md:p-5 transition-all hover:shadow-md hover:border-primary/30 animate-in fade-in slide-in-from-bottom-1"
              style={{ backgroundImage: "var(--gradient-card)" }}>
              <div className="flex items-start gap-3">
                <button onClick={() => cycleStatus(t)} aria-label="Cambiar estado"
                  className="mt-0.5 transition-transform hover:scale-110">
                  {t.status === "completada" ? (
                    <CheckCircle2 className="h-5 w-5 text-success" />
                  ) : t.status === "en progreso" ? (
                    <Clock className="h-5 w-5 text-accent" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className={`font-semibold ${t.status === "completada" ? "line-through text-muted-foreground" : ""}`}>{t.title}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${statusStyles[t.status as TaskStatus]}`}>{t.status}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityStyles[t.priority as TaskPriority]}`}>● {t.priority}</span>
                    {t.due_date && (
                      <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                        <CalendarIcon className="h-3 w-3" />
                        {new Date(t.due_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  {t.description && <p className="mt-1.5 text-sm text-muted-foreground">{t.description}</p>}
                </div>
                <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition">
                  <button onClick={() => openEdit(t)} className="p-2 rounded-md hover:bg-accent/15 hover:text-accent"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => setConfirmDelete(t)} className="p-2 rounded-md hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {modalOpen && (
        <TaskModal
          task={editing}
          onClose={() => setModalOpen(false)}
          onSave={async (input) => {
            try {
              if (editing) {
                await updateTask.mutateAsync({ id: editing.id, ...input });
                toast.success("Tarea actualizada");
              } else {
                await createTask.mutateAsync(input);
                toast.success("Tarea creada");
              }
              setModalOpen(false);
            } catch (e: any) { toast.error(e.message); }
          }}
          saving={createTask.isPending || updateTask.isPending}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          title="Eliminar tarea"
          description={`¿Seguro que quieres eliminar "${confirmDelete.title}"? Esta acción no se puede deshacer.`}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={handleDelete}
          confirming={deleteTask.isPending}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone }: { label: string; value: number; icon: any; tone: "primary" | "muted" | "accent" | "success" }) {
  const toneMap = {
    primary: "text-primary bg-primary/10",
    muted: "text-muted-foreground bg-muted",
    accent: "text-accent bg-accent/15",
    success: "text-success bg-success/15",
  } as const;
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5" style={{ backgroundImage: "var(--gradient-card)" }}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${toneMap[tone]}`}><Icon className="h-4 w-4" /></div>
      </div>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}

function Select({ icon: Icon, value, onChange, options }: { icon: any; value: string; onChange: (v: string) => void; options: { v: string; l: string }[] }) {
  return (
    <div className="relative">
      <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="appearance-none pl-10 pr-8 py-2.5 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring capitalize">
        {options.map((o) => <option key={o.v} value={o.v} className="capitalize">{o.l}</option>)}
      </select>
    </div>
  );
}

function EmptyState({ onCreate, hasTasks }: { onCreate: () => void; hasTasks: boolean }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-border bg-card/50 p-12 text-center">
      <div className="mx-auto h-14 w-14 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundImage: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}>
        <Sparkles className="h-6 w-6 text-primary-foreground" />
      </div>
      <h3 className="text-lg font-semibold">{hasTasks ? "Sin resultados" : "Aún no tienes tareas"}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{hasTasks ? "Prueba con otros filtros o búsqueda." : "Crea tu primera tarea para empezar."}</p>
      {!hasTasks && (
        <button onClick={onCreate} className="mt-5 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-primary-foreground"
          style={{ backgroundImage: "var(--gradient-primary)" }}>
          <Plus className="h-4 w-4" /> Crear tarea
        </button>
      )}
    </div>
  );
}

function TaskModal({ task, onClose, onSave, saving }: {
  task: Task | null;
  onClose: () => void;
  onSave: (input: { title: string; description: string | null; status: TaskStatus; priority: TaskPriority; due_date: string | null }) => void | Promise<void>;
  saving: boolean;
}) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [status, setStatus] = useState<TaskStatus>((task?.status as TaskStatus) ?? "pendiente");
  const [priority, setPriority] = useState<TaskPriority>((task?.priority as TaskPriority) ?? "media");
  const [dueDate, setDueDate] = useState(task?.due_date ? task.due_date.slice(0, 10) : "");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { toast.error("El título es obligatorio"); return; }
    if (title.length > 200) { toast.error("El título es demasiado largo"); return; }
    onSave({
      title: title.trim(),
      description: description.trim() || null,
      status, priority,
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/40 backdrop-blur-sm animate-in fade-in" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl bg-card border border-border shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-2">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-lg font-semibold">{task ? "Editar tarea" : "Nueva tarea"}</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-md hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-sm font-medium">Título *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required
              className="mt-1.5 w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="text-sm font-medium">Descripción</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} rows={3}
              className="mt-1.5 w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Estado</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm capitalize">
                {STATUSES.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Prioridad</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm capitalize">
                {PRIORITIES.map((p) => <option key={p} value={p} className="capitalize">{p}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Fecha límite (opcional)</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm" />
          </div>
        </div>
        <div className="flex justify-end gap-2 p-5 border-t border-border">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-input text-sm font-medium hover:bg-accent/10">Cancelar</button>
          <button type="submit" disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-primary-foreground disabled:opacity-60"
            style={{ backgroundImage: "var(--gradient-primary)", boxShadow: "var(--shadow-elegant)" }}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {task ? "Guardar" : "Crear"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ConfirmModal({ title, description, onCancel, onConfirm, confirming }: {
  title: string; description: string; onCancel: () => void; onConfirm: () => void; confirming: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/40 backdrop-blur-sm animate-in fade-in" onClick={onCancel}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl bg-card border border-border shadow-2xl p-5 animate-in zoom-in-95">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-full bg-destructive/10 text-destructive flex items-center justify-center"><AlertCircle className="h-5 w-5" /></div>
          <div className="flex-1">
            <h3 className="font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg border border-input text-sm font-medium hover:bg-accent/10">Cancelar</button>
          <button onClick={onConfirm} disabled={confirming}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-destructive text-destructive-foreground hover:opacity-90 disabled:opacity-60">
            {confirming && <Loader2 className="h-4 w-4 animate-spin" />}
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}
