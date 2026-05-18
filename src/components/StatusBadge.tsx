import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  planificacion: "Planificación",
  en_progreso: "En progreso",
  pausado: "Pausado",
  completado: "Completado",
  pendiente: "Pendiente",
  en_revision: "En revisión",
  completada: "Completada",
};

const STATUS_CLASSES: Record<string, string> = {
  planificacion: "bg-secondary text-secondary-foreground",
  en_progreso: "bg-primary/15 text-primary border-primary/30",
  pausado: "bg-warning/15 text-warning-foreground border-warning/40",
  completado: "bg-success/20 text-success-foreground border-success/40",
  pendiente: "bg-muted text-muted-foreground",
  en_revision: "bg-accent/20 text-accent-foreground border-accent/40",
  completada: "bg-success/20 text-success-foreground border-success/40",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium", STATUS_CLASSES[status] ?? "", className)}>
      {STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

const PRIORITY_CLASSES: Record<string, string> = {
  baja: "bg-muted text-muted-foreground",
  media: "bg-primary/10 text-primary",
  alta: "bg-warning/20 text-warning-foreground border-warning/40",
  critica: "bg-destructive/15 text-destructive border-destructive/40",
};

export function PriorityBadge({ priority, className }: { priority: string; className?: string }) {
  return (
    <Badge variant="outline" className={cn("capitalize font-medium", PRIORITY_CLASSES[priority] ?? "", className)}>
      {priority}
    </Badge>
  );
}
