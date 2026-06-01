import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Sparkles, Loader2, Copy, RefreshCw, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useGenerateSummary, useAiSummaries, type AiKind } from "@/hooks/use-ai-summaries";
import type { Task } from "@/hooks/use-tasks";

type Option = {
  value: AiKind;
  label: string;
  description: string;
  requiresTask?: boolean;
  adminOnly?: boolean;
};

const OPTIONS: Option[] = [
  { value: "resumen_diario", label: "Resumen diario", description: "Resumen del día con avances, riesgos y próximos pasos.", adminOnly: true },
  { value: "resumen_proyecto", label: "Resumen general del proyecto", description: "Visión completa del estado del proyecto.", adminOnly: true },
  { value: "reporte_ejecutivo", label: "Reporte ejecutivo", description: "Reporte formal y breve para dirección.", adminOnly: true },
  { value: "riesgos", label: "Detectar riesgos", description: "Identifica riesgos reales basados en datos." },
  { value: "bloqueos_atrasos", label: "Tareas bloqueadas o atrasadas", description: "Lista de tareas vencidas, próximas a vencer y bloqueos." },
  { value: "proximos_pasos", label: "Sugerir próximos pasos", description: "Recomendaciones concretas sobre qué hacer a continuación." },
  { value: "clasificar_urgencia", label: "Clasificar tareas por urgencia", description: "Agrupa las tareas según su urgencia real." },
  { value: "atencion_inmediata", label: "Atención inmediata", description: "Qué tareas requieren acción hoy." },
  { value: "resumen_tarea", label: "Resumen de una tarea", description: "Resumen profesional de una tarea específica.", requiresTask: true },
  { value: "comentarios_tarea", label: "Resumen de comentarios de tarea", description: "Resumen de avances y comentarios de una tarea.", requiresTask: true },
  { value: "borrador_correo", label: "Borrador de correo (tarea por vencer)", description: "Texto base para correo. No se envía nada todavía.", requiresTask: true },
];

export function AiPanel({
  projectId,
  tasks,
  isAdmin,
  hasComments,
}: {
  projectId: string;
  tasks: Task[];
  isAdmin: boolean;
  hasComments: boolean;
}) {
  const [kind, setKind] = useState<AiKind>("resumen_proyecto");
  const [taskId, setTaskId] = useState<string>("");
  const [result, setResult] = useState<{ label: string; content: string; generated_at: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const generate = useGenerateSummary(projectId);
  const { data: history } = useAiSummaries(projectId);

  const current = OPTIONS.find((o) => o.value === kind)!;
  const hasTasks = tasks.length > 0;

  // Validaciones previas (no llamamos a la IA si faltan datos)
  const preValidate = (): string | null => {
    if (!hasTasks) return "No hay tareas en el proyecto. Crea tareas antes de generar un análisis.";
    if (current.adminOnly && !isAdmin) return "Solo el administrador puede generar este reporte.";
    if (current.requiresTask && !taskId) return "Selecciona una tarea para este análisis.";
    if (current.value === "comentarios_tarea" && !hasComments) return "Aún no hay comentarios o avances registrados.";
    if (current.value === "riesgos" || current.value === "atencion_inmediata") {
      const ok = tasks.some((t) => t.start_date && t.end_date);
      if (!ok) return "No hay suficiente información de fechas para generar un análisis útil.";
    }
    if (current.value === "bloqueos_atrasos") {
      const today = new Date().toISOString().slice(0, 10);
      const hasIssue = tasks.some(
        (t) => (t.end_date < today && t.status !== "completada") ||
          (new Date(t.end_date).getTime() - Date.now()) / 86400000 <= 3,
      );
      if (!hasIssue) return "No hay tareas atrasadas ni próximas a vencer en este momento.";
    }
    return null;
  };

  const run = () => {
    const pre = preValidate();
    if (pre) {
      setErrorMsg(pre);
      setResult(null);
      return;
    }
    setErrorMsg(null);
    generate.mutate(
      { kind, taskId: current.requiresTask ? taskId : undefined },
      {
        onSuccess: (res) => {
          setResult({ label: res.label, content: res.content, generated_at: res.generated_at });
          toast.success("Análisis generado");
        },
        onError: (e: Error) => {
          setErrorMsg(e.message || "No fue posible generar el análisis.");
          setResult(null);
        },
      },
    );
  };

  const copy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.content);
    toast.success("Texto copiado");
  };

  return (
    <div className="space-y-4">
      <Card className="bg-gradient-to-br from-primary/5 to-accent/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent" /> Análisis con IA
          </CardTitle>
          <CardDescription>
            Selecciona el tipo de análisis. La IA usa únicamente los datos reales del proyecto y responde en texto profesional.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <Label>Tipo de análisis</Label>
              <Select value={kind} onValueChange={(v) => { setKind(v as AiKind); setErrorMsg(null); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OPTIONS.filter((o) => !o.adminOnly || isAdmin).map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">{current.description}</p>
            </div>

            {current.requiresTask && (
              <div>
                <Label>Tarea</Label>
                <Select value={taskId} onValueChange={setTaskId}>
                  <SelectTrigger>
                    <SelectValue placeholder={hasTasks ? "Selecciona una tarea" : "No hay tareas"} />
                  </SelectTrigger>
                  <SelectContent>
                    {tasks.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={run} disabled={generate.isPending}>
              {generate.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generando…</>
              ) : (
                <><Sparkles className="h-4 w-4 mr-2" /> Generar</>
              )}
            </Button>
            {result && !generate.isPending && (
              <>
                <Button variant="outline" onClick={run}>
                  <RefreshCw className="h-4 w-4 mr-2" /> Regenerar
                </Button>
                <Button variant="outline" onClick={copy}>
                  <Copy className="h-4 w-4 mr-2" /> Copiar
                </Button>
              </>
            )}
          </div>

          {errorMsg && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between gap-2 flex-wrap">
              <span>{result.label}</span>
              <Badge variant="outline" className="text-xs font-normal">
                Generado {new Date(result.generated_at).toLocaleString()}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
              {result.content}
            </pre>
          </CardContent>
        </Card>
      )}

      {!!history?.length && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Historial de reportes guardados</CardTitle>
            <CardDescription>Reportes diarios, generales y ejecutivos guardados anteriormente.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 max-h-[500px] overflow-y-auto">
            {history.map((s) => (
              <details key={s.id} className="rounded-md border bg-card p-3">
                <summary className="cursor-pointer text-sm font-medium flex items-center justify-between gap-2">
                  <span>Reporte del {s.summary_date}</span>
                  <Badge variant="outline" className="text-[10px] font-normal">
                    {new Date(s.created_at).toLocaleString()}
                  </Badge>
                </summary>
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground mt-3">
                  {s.content}
                </pre>
              </details>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
