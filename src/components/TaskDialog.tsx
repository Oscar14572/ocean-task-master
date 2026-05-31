import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge, PriorityBadge } from "@/components/StatusBadge";
import {
  AlertTriangle, Loader2, Lightbulb, MessageSquare, Trash2, Clock, CalendarDays, User as UserIcon, FolderKanban,
} from "lucide-react";
import type { Task } from "@/hooks/use-tasks";
import type { MemberWithProfile } from "@/hooks/use-members";
import {
  useTaskComments, useCreateComment, useDeleteComment,
} from "@/hooks/use-task-comments";
import { toast } from "sonner";
import { buildTaskSchema, friendlyError, commentSchema } from "@/lib/validations";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: Task | null;
  members: MemberWithProfile[];
  canEdit: boolean;
  projectId: string;
  projectName?: string;
  projectStart: string;
  projectEnd: string;
  currentUserId?: string;
  onSubmit: (values: {
    id?: string;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    start_date: string;
    end_date: string;
    progress: number;
    main_assignee_id: string | null;
  }) => Promise<void> | void;
  onDelete?: (id: string) => Promise<void> | void;
  onUpdateProgress?: (id: string, progress: number) => Promise<void> | void;
  onUpdateStatus?: (id: string, status: string) => Promise<void> | void;
  isAdmin?: boolean;
};

const todayStr = () => new Date().toISOString().slice(0, 10);

function daysUntil(date: string) {
  return Math.ceil((new Date(date).getTime() - new Date(todayStr()).getTime()) / 86400000);
}

export function TaskDialog({
  open, onOpenChange, initial, members, canEdit,
  projectId, projectName, projectStart, projectEnd, currentUserId,
  onSubmit, onDelete, onUpdateProgress, isAdmin,
}: Props) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    status: "pendiente",
    priority: "media",
    start_date: projectStart || todayStr(),
    end_date: projectStart || todayStr(),
    progress: 0,
    main_assignee_id: "" as string,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"detalles" | "avances">("detalles");

  useEffect(() => {
    setErrors({});
    setTab("detalles");
    if (initial) {
      setForm({
        title: initial.title,
        description: initial.description ?? "",
        status: initial.status,
        priority: initial.priority,
        start_date: initial.start_date,
        end_date: initial.end_date,
        progress: initial.progress,
        main_assignee_id: initial.main_assignee_id ?? "",
      });
    } else {
      setForm({
        title: "",
        description: "",
        status: "pendiente",
        priority: "media",
        start_date: projectStart || todayStr(),
        end_date: projectStart || todayStr(),
        progress: 0,
        main_assignee_id: "",
      });
    }
  }, [initial, open, projectStart]);

  const schema = useMemo(() => buildTaskSchema(projectStart, projectEnd), [projectStart, projectEnd]);

  const warnCompletedNoProgress = form.status === "completada" && form.progress < 100;
  const warnProgress100NotDone = form.progress === 100 && form.status !== "completada";

  const assigneeLabel = useMemo(() => {
    if (!form.main_assignee_id) return "Sin asignar";
    const m = members.find((x) => x.user_id === form.main_assignee_id);
    return m?.profile?.full_name || m?.profile?.username || m?.profile?.email || "Usuario";
  }, [form.main_assignee_id, members]);

  // Indicadores visuales sobre la tarea actual (datos guardados)
  const taskStatus = initial?.status ?? form.status;
  const taskEnd = initial?.end_date ?? form.end_date;
  const taskProgress = initial?.progress ?? form.progress;
  const isCompleted = taskStatus === "completada";
  const isBlocked = taskStatus === "bloqueada";
  const daysLeft = daysUntil(taskEnd);
  const isOverdue = !isCompleted && daysLeft < 0;
  const isDueSoon = !isCompleted && daysLeft >= 0 && daysLeft <= 3;

  const submit = async () => {
    setErrors({});
    const parsed = schema.safeParse({
      ...form,
      main_assignee_id: form.main_assignee_id || null,
    });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.issues.forEach((i) => {
        const k = i.path[0]?.toString() ?? "_";
        if (!fieldErrors[k]) fieldErrors[k] = i.message;
      });
      setErrors(fieldErrors);
      toast.error("Revisa los campos marcados");
      return;
    }
    const finalProgress = parsed.data.status === "completada" ? 100 : parsed.data.progress;

    setSaving(true);
    try {
      await onSubmit({
        id: initial?.id,
        title: parsed.data.title,
        description: parsed.data.description || null,
        status: parsed.data.status,
        priority: parsed.data.priority,
        start_date: parsed.data.start_date,
        end_date: parsed.data.end_date,
        progress: finalProgress,
        main_assignee_id: parsed.data.main_assignee_id || null,
      });
      onOpenChange(false);
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setSaving(false);
    }
  };

  const applySuggestion = () => {
    if (warnCompletedNoProgress) setForm({ ...form, progress: 100 });
    else if (warnProgress100NotDone) setForm({ ...form, status: "completada" });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !saving && onOpenChange(v)}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            {initial ? initial.title : "Nueva tarea"}
            {initial && <StatusBadge status={initial.status} />}
            {initial && <PriorityBadge priority={initial.priority} />}
            {isBlocked && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" /> Bloqueada
              </Badge>
            )}
            {isOverdue && <Badge variant="destructive">Vencida</Badge>}
            {isDueSoon && !isOverdue && (
              <Badge variant="outline" className="border-warning/40 text-warning-foreground bg-warning/15">
                Vence en {daysLeft === 0 ? "hoy" : `${daysLeft}d`}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {projectName && <span className="inline-flex items-center gap-1 mr-3"><FolderKanban className="h-3 w-3" /> {projectName}</span>}
            Rango del proyecto: {projectStart} → {projectEnd}
          </DialogDescription>
        </DialogHeader>

        {initial && (
          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Progreso</span>
              <span className="font-medium text-foreground">{taskProgress}%</span>
            </div>
            <Progress value={taskProgress} className="h-2" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-muted-foreground pt-1">
              <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" /> {initial.start_date} → {initial.end_date}</span>
              <span className="flex items-center gap-1"><UserIcon className="h-3 w-3" /> {assigneeLabel}</span>
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Creada: {new Date(initial.created_at).toLocaleDateString()}</span>
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Actualizada: {new Date(initial.updated_at).toLocaleDateString()}</span>
            </div>
          </div>
        )}

        <Tabs value={tab} onValueChange={(v) => setTab(v as "detalles" | "avances")} className="mt-2">
          <TabsList>
            <TabsTrigger value="detalles">Detalles</TabsTrigger>
            <TabsTrigger value="avances" disabled={!initial}>
              <MessageSquare className="h-3 w-3 mr-1" /> Avances
            </TabsTrigger>
          </TabsList>

          <TabsContent value="detalles" className="space-y-4 pt-2">
            <div>
              <Label>Título *</Label>
              <Input
                value={form.title}
                disabled={!canEdit || saving}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                maxLength={200}
                aria-invalid={!!errors.title}
              />
              {errors.title && <p className="text-xs text-destructive mt-1">{errors.title}</p>}
            </div>
            <div>
              <Label>Descripción</Label>
              <Textarea
                value={form.description}
                disabled={!canEdit || saving}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                maxLength={2000}
                placeholder="Describe el objetivo, contexto o criterios de aceptación..."
              />
              {errors.description && <p className="text-xs text-destructive mt-1">{errors.description}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Estado</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })} disabled={!canEdit || saving}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendiente">Pendiente</SelectItem>
                    <SelectItem value="en_progreso">En progreso</SelectItem>
                    <SelectItem value="en_revision">En revisión</SelectItem>
                    <SelectItem value="completada">Completada</SelectItem>
                    <SelectItem value="bloqueada">Bloqueada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prioridad</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })} disabled={!canEdit || saving}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baja">Baja</SelectItem>
                    <SelectItem value="media">Media</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="critica">Crítica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Fecha inicio *</Label>
                <Input
                  type="date" min={projectStart} max={projectEnd}
                  value={form.start_date}
                  disabled={!canEdit || saving}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  aria-invalid={!!errors.start_date}
                />
                {errors.start_date && <p className="text-xs text-destructive mt-1">{errors.start_date}</p>}
              </div>
              <div>
                <Label>Fecha vencimiento *</Label>
                <Input
                  type="date" min={projectStart} max={projectEnd}
                  value={form.end_date}
                  disabled={!canEdit || saving}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  aria-invalid={!!errors.end_date}
                />
                {errors.end_date && <p className="text-xs text-destructive mt-1">{errors.end_date}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Responsable</Label>
                <Select
                  value={form.main_assignee_id || "none"}
                  onValueChange={(v) => setForm({ ...form, main_assignee_id: v === "none" ? "" : v })}
                  disabled={!canEdit || saving}
                >
                  <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin asignar</SelectItem>
                    {members.map((m) => (
                      <SelectItem key={m.user_id} value={m.user_id}>
                        {m.profile?.full_name || m.profile?.username || m.profile?.email || "Usuario"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">Solo miembros del proyecto.</p>
              </div>
              <div>
                <Label>Avance: {form.progress}%</Label>
                <Input
                  type="number" min={0} max={100}
                  value={form.progress}
                  disabled={!canEdit || saving}
                  onChange={(e) => setForm({ ...form, progress: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                  aria-invalid={!!errors.progress}
                />
                {errors.progress && <p className="text-xs text-destructive mt-1">{errors.progress}</p>}
              </div>
            </div>

            {warnCompletedNoProgress && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="flex items-center justify-between gap-3">
                  <span>La tarea está completada pero el progreso es {form.progress}%.</span>
                  <Button size="sm" variant="outline" type="button" onClick={applySuggestion}>Ajustar a 100%</Button>
                </AlertDescription>
              </Alert>
            )}
            {warnProgress100NotDone && (
              <Alert>
                <Lightbulb className="h-4 w-4" />
                <AlertDescription className="flex items-center justify-between gap-3">
                  <span>El progreso llegó al 100%. ¿Marcarla como completada?</span>
                  <Button size="sm" variant="outline" type="button" onClick={applySuggestion}>Marcar completada</Button>
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>

          <TabsContent value="avances" className="pt-2">
            {initial ? (
              <TaskAvancesPanel
                taskId={initial.id}
                projectId={projectId}
                currentUserId={currentUserId}
                currentProgress={initial.progress}
                isAdmin={!!isAdmin}
                canPost={!!canEdit}
                onApplyProgress={onUpdateProgress ? (p) => onUpdateProgress(initial.id, p) : undefined}
              />
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                Guarda la tarea para empezar a registrar avances.
              </p>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2">
          {initial && isAdmin && onDelete && (
            <Button
              variant="destructive"
              disabled={saving}
              onClick={async () => {
                if (!confirm("¿Eliminar esta tarea? Esta acción no se puede deshacer.")) return;
                setSaving(true);
                try {
                  await onDelete(initial.id);
                  onOpenChange(false);
                } catch (e) {
                  toast.error(friendlyError(e));
                } finally {
                  setSaving(false);
                }
              }}
              className="mr-auto"
            >
              <Trash2 className="h-4 w-4 mr-1" /> Eliminar
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cerrar</Button>
          {canEdit && tab === "detalles" && (
            <Button onClick={submit} disabled={saving}>
              {saving ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Guardando...</>) : initial ? "Guardar cambios" : "Crear tarea"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============== Panel de Avances (historial + composer) ==============

function TaskAvancesPanel({
  taskId, projectId, currentUserId, currentProgress, isAdmin, canPost, onApplyProgress,
}: {
  taskId: string;
  projectId: string;
  currentUserId?: string;
  currentProgress: number;
  isAdmin: boolean;
  canPost: boolean;
  onApplyProgress?: (progress: number) => Promise<void> | void;
}) {
  const { data: comments, isLoading } = useTaskComments(taskId);
  const createComment = useCreateComment(projectId, currentUserId);
  const deleteComment = useDeleteComment(projectId);

  const [text, setText] = useState("");
  const [type, setType] = useState<"avance" | "bloqueo" | "nota">("avance");
  const [progress, setProgress] = useState<number>(currentProgress);
  const [posting, setPosting] = useState(false);

  useEffect(() => { setProgress(currentProgress); }, [currentProgress, taskId]);

  const handlePost = async () => {
    const parsed = commentSchema.safeParse({
      task_id: taskId,
      comment: text,
      type,
      progress_reported: type === "avance" ? progress : 0,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }
    setPosting(true);
    try {
      await createComment.mutateAsync({
        task_id: taskId,
        comment: parsed.data.comment,
        type: parsed.data.type,
        progress_reported: type === "avance" ? parsed.data.progress_reported : null,
      });
      toast.success(
        type === "bloqueo" ? "Bloqueo reportado" : type === "nota" ? "Nota publicada" : "Avance publicado"
      );

      // Sugerencia automática: si el avance reportado supera el actual
      if (type === "avance" && onApplyProgress && parsed.data.progress_reported > currentProgress) {
        if (confirm(`¿Actualizar el progreso de la tarea a ${parsed.data.progress_reported}%?`)) {
          await onApplyProgress(parsed.data.progress_reported);
          if (parsed.data.progress_reported === 100) {
            toast.message("La tarea llegó al 100%", { description: "Considera marcarla como completada desde Detalles." });
          }
        }
      }
      setText("");
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="space-y-4">
      {canPost ? (
        <div className="rounded-lg border p-3 space-y-3 bg-card">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="avance">Avance</SelectItem>
                  <SelectItem value="bloqueo">Bloqueo</SelectItem>
                  <SelectItem value="nota">Nota</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {type === "avance" && (
              <div>
                <Label className="text-xs">Progreso reportado: {progress}%</Label>
                <Input
                  type="number" min={0} max={100} value={progress}
                  onChange={(e) => setProgress(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                />
              </div>
            )}
          </div>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder={
              type === "bloqueo"
                ? "Describe el bloqueo: qué está frenando la tarea, qué necesitas..."
                : type === "nota"
                  ? "Agrega una nota o contexto..."
                  : "¿Qué avanzaste? ¿Qué sigue?"
            }
          />
          <div className="flex justify-end">
            <Button onClick={handlePost} disabled={posting || !text.trim()}>
              {posting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <MessageSquare className="h-4 w-4 mr-2" />}
              Publicar
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No tienes permisos para comentar en esta tarea.</p>
      )}

      <div className="space-y-2 max-h-[360px] overflow-y-auto">
        {isLoading && (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        )}
        {!isLoading && !comments?.length && (
          <div className="text-center text-sm text-muted-foreground py-8 border border-dashed rounded-lg">
            Aún no hay comentarios ni avances. ¡Sé el primero en aportar!
          </div>
        )}
        {comments?.map((c) => {
          const isBloqueo = c.type === "bloqueo";
          const isAvance = c.type === "avance";
          return (
            <div
              key={c.id}
              className={`rounded-lg border p-3 ${
                isBloqueo
                  ? "bg-destructive/10 border-destructive/40"
                  : isAvance
                    ? "bg-primary/5 border-primary/30"
                    : "bg-muted/40"
              }`}
            >
              <div className="flex items-start justify-between text-xs mb-1">
                <div className="flex items-center gap-2">
                  <Badge
                    variant={isBloqueo ? "destructive" : "outline"}
                    className="capitalize text-[10px]"
                  >
                    {isBloqueo && <AlertTriangle className="h-3 w-3 mr-1" />}
                    {c.type}
                  </Badge>
                  <span className="text-muted-foreground">
                    {new Date(c.created_at).toLocaleString("es")}
                  </span>
                </div>
                {(isAdmin || c.user_id === currentUserId) && (
                  <Button
                    variant="ghost" size="icon" className="h-6 w-6"
                    onClick={() => {
                      if (confirm("¿Eliminar este comentario?")) {
                        deleteComment.mutate(c.id, {
                          onSuccess: () => toast.success("Comentario eliminado"),
                          onError: (e) => toast.error(friendlyError(e)),
                        });
                      }
                    }}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                )}
              </div>
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
      </div>
    </div>
  );
}
