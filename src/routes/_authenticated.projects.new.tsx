import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useCreateProject } from "@/hooks/use-projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/projects/new")({
  component: NewProjectPage,
});

function NewProjectPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const create = useCreateProject(user?.id);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !start || !end) return toast.error("Completa los campos requeridos");
    if (end < start) return toast.error("La fecha final no puede ser anterior a la inicial");
    create.mutate(
      { name, description: description || null, start_date: start, end_date: end },
      {
        onSuccess: (p) => {
          toast.success("Proyecto creado");
          navigate({ to: "/projects/$projectId", params: { projectId: p.id } });
        },
        onError: (e: Error) => toast.error(e.message),
      },
    );
  };

  return (
    <div className="p-6 md:p-10 max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Crear nuevo proyecto</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label>Nombre *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required />
            </div>
            <div>
              <Label>Descripción</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Fecha inicio *</Label>
                <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} required />
              </div>
              <div>
                <Label>Fecha fin *</Label>
                <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} required />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => navigate({ to: "/dashboard" })}>
                Cancelar
              </Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? "Creando..." : "Crear proyecto"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
