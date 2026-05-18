import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Task } from "@/hooks/use-tasks";
import type { MemberWithProfile } from "@/hooks/use-members";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: Task | null;
  members: MemberWithProfile[];
  canEdit: boolean;
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

const today = () => new Date().toISOString().slice(0, 10);

export function TaskDialog({ open, onOpenChange, initial, members, canEdit, onSubmit, onDelete, isAdmin }: Props) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    status: "pendiente",
    priority: "media",
    start_date: today(),
    end_date: today(),
    progress: 0,
    main_assignee_id: "" as string,
  });

  useEffect(() => {
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
        start_date: today(),
        end_date: today(),
        progress: 0,
        main_assignee_id: "",
      });
    }
  }, [initial, open]);

  const submit = async () => {
    if (!form.title.trim()) return toast.error("El título es obligatorio");
    if (form.end_date < form.start_date) return toast.error("La fecha final no puede ser anterior a la inicial");
    if (form.progress < 0 || form.progress > 100) return toast.error("El progreso debe estar entre 0 y 100");
    try {
      await onSubmit({
        id: initial?.id,
        title: form.title.trim(),
        description: form.description.trim() || null,
        status: form.status,
        priority: form.priority,
        start_date: form.start_date,
        end_date: form.end_date,
        progress: form.progress,
        main_assignee_id: form.main_assignee_id || null,
      });
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar tarea" : "Nueva tarea"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div>
            <Label>Título *</Label>
            <Input
              value={form.title}
              disabled={!canEdit}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              maxLength={200}
            />
          </div>
          <div>
            <Label>Descripción</Label>
            <Textarea
              value={form.description}
              disabled={!canEdit}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              maxLength={2000}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Estado</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })} disabled={!canEdit}>
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
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })} disabled={!canEdit}>
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
                value={form.start_date}
                disabled={!canEdit}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              />
            </div>
            <div>
              <Label>Fecha fin *</Label>
              <Input
                type="date"
                value={form.end_date}
                disabled={!canEdit}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Responsable</Label>
              <Select
                value={form.main_assignee_id || "none"}
                onValueChange={(v) => setForm({ ...form, main_assignee_id: v === "none" ? "" : v })}
                disabled={!canEdit}
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
            </div>
            <div>
              <Label>Avance: {form.progress}%</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={form.progress}
                onChange={(e) => setForm({ ...form, progress: Number(e.target.value) })}
              />
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2">
          {initial && isAdmin && onDelete && (
            <Button
              variant="destructive"
              onClick={async () => {
                if (!confirm("¿Eliminar esta tarea?")) return;
                try {
                  await onDelete(initial.id);
                  onOpenChange(false);
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
              className="mr-auto"
            >
              Eliminar
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          {canEdit && <Button onClick={submit}>{initial ? "Guardar" : "Crear"}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
