import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { inviteEmailSchema, inviteUsernameSchema, friendlyError } from "@/lib/validations";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onInvite: (input: { email?: string; username?: string; role: string }) => Promise<void>;
};

export function InviteDialog({ open, onOpenChange, onInvite }: Props) {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<"admin" | "colaborador" | "observador">("colaborador");
  const [tab, setTab] = useState("email");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const reset = () => {
    setEmail("");
    setUsername("");
    setRole("colaborador");
    setErrors({});
  };

  const submit = async () => {
    setErrors({});
    let payload: { email?: string; username?: string; role: string };
    if (tab === "email") {
      const parsed = inviteEmailSchema.safeParse({ email, role });
      if (!parsed.success) {
        const e: Record<string, string> = {};
        parsed.error.issues.forEach((i) => (e[i.path[0]?.toString() ?? "_"] = i.message));
        setErrors(e);
        return;
      }
      payload = { email: parsed.data.email, role: parsed.data.role };
    } else {
      const parsed = inviteUsernameSchema.safeParse({ username, role });
      if (!parsed.success) {
        const e: Record<string, string> = {};
        parsed.error.issues.forEach((i) => (e[i.path[0]?.toString() ?? "_"] = i.message));
        setErrors(e);
        return;
      }
      payload = { username: parsed.data.username, role: parsed.data.role };
    }

    setLoading(true);
    try {
      await onInvite(payload);
      toast.success("Invitación enviada correctamente");
      reset();
      onOpenChange(false);
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !loading && onOpenChange(v)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invitar miembro</DialogTitle>
          <DialogDescription>Envía una invitación por correo o por nombre de usuario.</DialogDescription>
        </DialogHeader>
        <Tabs value={tab} onValueChange={(v) => { setTab(v); setErrors({}); }}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="email">Por correo</TabsTrigger>
            <TabsTrigger value="username">Por usuario</TabsTrigger>
          </TabsList>
          <TabsContent value="email" className="space-y-2">
            <Label>Correo electrónico *</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="persona@correo.com"
              maxLength={255}
              disabled={loading}
              aria-invalid={!!errors.email}
            />
            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
          </TabsContent>
          <TabsContent value="username" className="space-y-2">
            <Label>Nombre de usuario *</Label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ana_lopez"
              maxLength={50}
              disabled={loading}
              aria-invalid={!!errors.username}
            />
            {errors.username && <p className="text-xs text-destructive">{errors.username}</p>}
          </TabsContent>
        </Tabs>
        <div>
          <Label>Rol *</Label>
          <Select value={role} onValueChange={(v) => setRole(v as typeof role)} disabled={loading}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Administrador (control total)</SelectItem>
              <SelectItem value="colaborador">Colaborador (crear y editar tareas)</SelectItem>
              <SelectItem value="observador">Observador (solo lectura)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={submit} disabled={loading}>
            {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando...</> : "Enviar invitación"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
