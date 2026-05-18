import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useJoinByCode } from "@/hooks/use-projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/projects/join")({
  component: JoinPage,
});

function JoinPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const join = useJoinByCode(user?.id);
  const [code, setCode] = useState("");

  return (
    <div className="p-6 md:p-10 max-w-md mx-auto">
      <Card>
        <CardHeader><CardTitle>Unirme a un proyecto</CardTitle></CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!code.trim()) return;
              join.mutate(code, {
                onSuccess: (p) => {
                  toast.success(`Te uniste a "${p.name}"`);
                  navigate({ to: "/projects/$projectId", params: { projectId: p.id } });
                },
                onError: (e: Error) => toast.error(e.message),
              });
            }}
            className="space-y-4"
          >
            <div>
              <Label>Clave de acceso</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ej: ABC-123" />
            </div>
            <Button type="submit" disabled={join.isPending} className="w-full">
              {join.isPending ? "Uniendo..." : "Unirme"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
