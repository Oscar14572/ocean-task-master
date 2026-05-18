import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onInvite: (input: { email?: string; username?: string; role: string }) => Promise<void>;
};

export function InviteDialog({ open, onOpenChange, onInvite }: Props) {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [role, setRole] = useState("colaborador");
  const [tab, setTab] = useState("email");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      if (tab === "email") {
        if (!email.trim()) return toast.error("Indica un correo");
        await onInvite({ email: email.trim(), role });
      } else {
        if (!username.trim()) return toast.error("Indica un nombre de usuario");
        await onInvite({ username: username.trim(), role });
      }
      toast.success("Invitación enviada");
      setEmail("");
      setUsername("");
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invitar miembro</DialogTitle>
          <DialogDescription>Envía una invitación por correo o por nombre de usuario.</DialogDescription>
        </DialogHeader>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="email">Por correo</TabsTrigger>
            <TabsTrigger value="username">Por usuario</TabsTrigger>
          </TabsList>
          <TabsContent value="email" className="space-y-2">
            <Label>Correo electrónico</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="persona@correo.com" />
          </TabsContent>
          <TabsContent value="username" className="space-y-2">
            <Label>Nombre de usuario</Label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="ana_lopez" />
          </TabsContent>
        </Tabs>
        <div>
          <Label>Rol</Label>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Administrador</SelectItem>
              <SelectItem value="colaborador">Colaborador</SelectItem>
              <SelectItem value="observador">Observador</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={loading}>{loading ? "Enviando..." : "Enviar invitación"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
