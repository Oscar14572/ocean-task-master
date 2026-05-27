import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Loader2, Lightbulb } from "lucide-react";
import type { Task } from "@/hooks/use-tasks";
import type { MemberWithProfile } from "@/hooks/use-members";
import { toast } from "sonner";
import { buildTaskSchema, friendlyError } from "@/lib/validations";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: Task | null;
  members: MemberWithProfile[];
  canEdit: boolean;
  projectStart: string;
  projectEnd: string;
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
  isAdmin?: boolean;
};

const todayStr = () => new Date().toISOString().slice(0, 10);

export function TaskDialog({
  open, onOpenChange, initial, members, canEdit, projectStart, projectEnd, onSubmit, onDelete, isAdmin,
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

  useEffect(() => {
    setErrors({});
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

  // Avisos contextuales (no bloquean, solo advierten)
  const warnCompletedNoProgress = form.status === "completada" && form.progress < 100;
  const warnProgress100NotDone = form.progress === 100 && form.status !== "completada";

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

    // Ajuste automático: si está completada, forzar 100%
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar tarea" : "Nueva tarea"}</DialogTitle>
          <DialogDescription>
            Las fechas deben estar dentro del rango del proyecto ({projectStart} → {projectEnd}).
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
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
                type="date"
                min={projectStart}
                max={projectEnd}
                value={form.start_date}
                disabled={!canEdit || saving}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                aria-invalid={!!errors.start_date}
              />
              {errors.start_date && <p className="text-xs text-destructive mt-1">{errors.start_date}</p>}
            </div>
            <div>
              <Label>Fecha fin *</Label>
              <Input
                type="date"
                min={projectStart}
                max={projectEnd}
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
              <p className="text-xs text-muted-foreground mt-1">Solo se permiten miembros del proyecto.</p>
            </div>
            <div>
              <Label>Avance: {form.progress}%</Label>
              <Input
                type="number"
                min={0}
                max={100}
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
                <span>La tarea está marcada como completada pero el progreso es {form.progress}%.</span>
                <Button size="sm" variant="outline" type="button" onClick={applySuggestion}>
                  Ajustar a 100%
                </Button>
              </AlertDescription>
            </Alert>
          )}
          {warnProgress100NotDone && (
            <Alert>
              <Lightbulb className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between gap-3">
                <span>El progreso llegó al 100%. ¿Quieres marcarla como completada?</span>
                <Button size="sm" variant="outline" type="button" onClick={applySuggestion}>
                  Marcar completada
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </div>
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
              Eliminar
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          {canEdit && (
            <Button onClick={submit} disabled={saving}>
              {saving ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Guardando...</>
              ) : initial ? "Guardar cambios" : "Crear tarea"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
