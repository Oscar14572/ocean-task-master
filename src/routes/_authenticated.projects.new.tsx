import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useCreateProject } from "@/hooks/use-projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { projectSchema, friendlyError } from "@/lib/validations";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/projects/new")({
  component: NewProjectPage,
});

function NewProjectPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const create = useCreateProject(user?.id);
  const [form, setForm] = useState({ name: "", description: "", start_date: "", end_date: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const parsed = projectSchema.safeParse(form);
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
    create.mutate(
      {
        name: parsed.data.name,
        description: parsed.data.description || null,
        start_date: parsed.data.start_date,
        end_date: parsed.data.end_date,
      },
      {
        onSuccess: (p) => {
          toast.success("Proyecto creado correctamente");
          navigate({ to: "/projects/$projectId", params: { projectId: p.id } });
        },
        onError: (e) => toast.error(friendlyError(e)),
      },
    );
  };

  return (
    <div className="p-6 md:p-10 max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Crear nuevo proyecto</CardTitle>
          <CardDescription>Define el alcance temporal y descripción del proyecto.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <div>
              <Label>Nombre del proyecto *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                maxLength={120}
                disabled={create.isPending}
                aria-invalid={!!errors.name}
              />
              {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
            </div>
            <div>
              <Label>Descripción</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                maxLength={2000}
                disabled={create.isPending}
                placeholder="¿Qué busca lograr este proyecto?"
              />
              {errors.description && <p className="text-xs text-destructive mt-1">{errors.description}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Fecha inicio *</Label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  disabled={create.isPending}
                  aria-invalid={!!errors.start_date}
                />
                {errors.start_date && <p className="text-xs text-destructive mt-1">{errors.start_date}</p>}
              </div>
              <div>
                <Label>Fecha fin *</Label>
                <Input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  disabled={create.isPending}
                  aria-invalid={!!errors.end_date}
                />
                {errors.end_date && <p className="text-xs text-destructive mt-1">{errors.end_date}</p>}
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => navigate({ to: "/dashboard" })} disabled={create.isPending}>
                Cancelar
              </Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creando...
                  </>
                ) : (
                  "Crear proyecto"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
