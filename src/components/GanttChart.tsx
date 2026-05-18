import { useMemo } from "react";
import type { Task } from "@/hooks/use-tasks";
import { cn } from "@/lib/utils";

type Props = {
  tasks: Task[];
  groupBy?: "status" | "priority" | "assignee";
  onSelect?: (task: Task) => void;
  assigneeNames?: Map<string, string>;
};

const STATUS_COLOR: Record<string, string> = {
  pendiente: "bg-muted-foreground/50",
  en_progreso: "bg-primary",
  en_revision: "bg-accent",
  completada: "bg-success",
  bloqueada: "bg-destructive",
};

const DAY_MS = 86_400_000;

function parseDate(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day).getTime();
}

export function GanttChart({ tasks, groupBy = "status", onSelect, assigneeNames }: Props) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);

  const { minDate, maxDate, totalDays, groups } = useMemo(() => {
    if (!tasks.length) {
      return { minDate: today, maxDate: today + 14 * DAY_MS, totalDays: 14, groups: [] as Array<[string, Task[]]> };
    }
    const starts = tasks.map((t) => parseDate(t.start_date));
    const ends = tasks.map((t) => parseDate(t.end_date));
    const min = Math.min(...starts, today) - 2 * DAY_MS;
    const max = Math.max(...ends, today) + 2 * DAY_MS;
    const days = Math.max(7, Math.round((max - min) / DAY_MS));

    const groupKey = (t: Task) => {
      if (groupBy === "status") return t.status;
      if (groupBy === "priority") return t.priority;
      return t.main_assignee_id ? assigneeNames?.get(t.main_assignee_id) ?? "Asignado" : "Sin responsable";
    };
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      const k = groupKey(t);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(t);
    }
    return {
      minDate: min,
      maxDate: max,
      totalDays: days,
      groups: Array.from(map.entries()),
    };
  }, [tasks, groupBy, today, assigneeNames]);

  const pxPerDay = 36;
  const width = totalDays * pxPerDay;
  const rowHeight = 36;
  const labelWidth = 220;

  const dayMarkers: Array<{ x: number; label: string; isToday: boolean; isMonthStart: boolean }> = [];
  for (let i = 0; i <= totalDays; i++) {
    const t = minDate + i * DAY_MS;
    const d = new Date(t);
    dayMarkers.push({
      x: i * pxPerDay,
      label: `${d.getDate()}`,
      isToday: t === today,
      isMonthStart: d.getDate() === 1,
    });
  }

  return (
    <div className="w-full border rounded-lg overflow-hidden bg-card">
      <div className="overflow-x-auto">
        <div style={{ minWidth: width + labelWidth }}>
          {/* Header with dates */}
          <div className="flex border-b sticky top-0 bg-muted/40 z-10">
            <div style={{ width: labelWidth }} className="shrink-0 px-3 py-2 text-xs font-semibold text-muted-foreground border-r">
              Tarea
            </div>
            <div className="relative" style={{ width }}>
              <div className="flex">
                {dayMarkers.slice(0, -1).map((m, i) => (
                  <div
                    key={i}
                    className={cn(
                      "text-[10px] text-center text-muted-foreground border-r border-border/40 py-1",
                      m.isMonthStart && "font-bold text-foreground",
                      m.isToday && "bg-primary/15 text-primary font-bold",
                    )}
                    style={{ width: pxPerDay }}
                  >
                    {m.label}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Body */}
          {groups.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Aún no hay tareas para mostrar.</div>
          ) : (
            groups.map(([groupName, items]) => (
              <div key={groupName}>
                <div className="flex bg-muted/20 border-b">
                  <div style={{ width: labelWidth + width }} className="px-3 py-1.5 text-xs font-semibold text-primary uppercase tracking-wide">
                    {groupName.replace(/_/g, " ")}  · {items.length}
                  </div>
                </div>
                {items.map((t) => {
                  const start = parseDate(t.start_date);
                  const end = parseDate(t.end_date);
                  const offsetDays = (start - minDate) / DAY_MS;
                  const durationDays = Math.max(1, (end - start) / DAY_MS + 1);
                  const left = offsetDays * pxPerDay;
                  const barWidth = durationDays * pxPerDay - 4;
                  const isOverdue = end < today && t.status !== "completada";
                  const isUpcoming = !isOverdue && end - today <= 3 * DAY_MS && end >= today && t.status !== "completada";
                  return (
                    <div
                      key={t.id}
                      className="flex border-b hover:bg-muted/20 cursor-pointer group"
                      onClick={() => onSelect?.(t)}
                      style={{ height: rowHeight }}
                    >
                      <div
                        style={{ width: labelWidth }}
                        className="shrink-0 px-3 py-2 text-xs border-r flex items-center gap-2 truncate"
                      >
                        <span className="truncate">{t.title}</span>
                      </div>
                      <div className="relative" style={{ width, height: rowHeight }}>
                        {/* day grid */}
                        {dayMarkers.slice(0, -1).map((m, i) => (
                          <div
                            key={i}
                            className={cn(
                              "absolute top-0 bottom-0 border-r border-border/30",
                              m.isToday && "bg-primary/10",
                            )}
                            style={{ left: m.x, width: pxPerDay }}
                          />
                        ))}
                        {/* bar */}
                        <div
                          className={cn(
                            "absolute top-1.5 rounded-md shadow-sm overflow-hidden transition-all group-hover:ring-2 group-hover:ring-primary/40",
                            STATUS_COLOR[t.status] ?? "bg-primary",
                            isOverdue && "ring-2 ring-destructive",
                          )}
                          style={{ left, width: barWidth, height: rowHeight - 12 }}
                          title={`${t.title} · ${t.progress}%`}
                        >
                          <div
                            className="h-full bg-white/30"
                            style={{ width: `${t.progress}%` }}
                          />
                          <div className="absolute inset-0 flex items-center px-2 text-[10px] font-semibold text-white whitespace-nowrap">
                            {t.progress}%
                            {isOverdue && <span className="ml-2 px-1 rounded bg-destructive/90">Vencida</span>}
                            {isUpcoming && <span className="ml-2 px-1 rounded bg-warning text-warning-foreground">Pronto</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
