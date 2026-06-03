import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ListChecks, Loader2 } from "lucide-react";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Crear cuenta — Ocean Task Master" }] }),
  component: SignupPage,
});

const schema = z.object({
  email: z.string().trim().email("Email inválido").max(255),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres").max(72),
});

function SignupPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setLoading(true);
    const redirectUrl = `${window.location.origin}/dashboard`;
    const { error } = await supabase.auth.signUp({
      ...parsed.data,
      options: { emailRedirectTo: redirectUrl },
    });
    setLoading(false);
    if (error) {
      if (error.message.toLowerCase().includes("already")) toast.error("Ese email ya está registrado.");
      else toast.error(error.message);
      return;
    }
    toast.success("¡Cuenta creada! Revisa tu email para confirmar.");
    navigate({ to: "/login" });
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between p-12 text-sidebar-foreground" style={{ backgroundImage: "var(--gradient-hero)" }}>
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/15 backdrop-blur">
            <ListChecks className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold">Ocean Task Master</span>
        </Link>
        <div>
          <h2 className="text-4xl font-bold leading-tight">Empieza a organizarte hoy.</h2>
          <p className="mt-4 text-white/80 max-w-md">Crea tu cuenta gratis y empieza a gestionar tus tareas con un dashboard moderno.</p>
        </div>
        <p className="text-xs text-white/60">© {new Date().getFullYear()} Ocean Task Master</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <h1 className="text-3xl font-bold">Crear cuenta</h1>
          <p className="mt-2 text-sm text-muted-foreground">Solo te lleva un minuto.</p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div>
              <label className="text-sm font-medium">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                className="mt-1.5 w-full rounded-lg border border-input bg-card px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring transition" />
            </div>
            <div>
              <label className="text-sm font-medium">Contraseña</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
                className="mt-1.5 w-full rounded-lg border border-input bg-card px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring transition" />
              <p className="mt-1 text-xs text-muted-foreground">Mínimo 6 caracteres.</p>
            </div>
            <button disabled={loading} type="submit"
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 disabled:opacity-60"
              style={{ backgroundImage: "var(--gradient-primary)", boxShadow: "var(--shadow-elegant)" }}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Crear cuenta
            </button>
          </form>

          <p className="mt-6 text-sm text-center text-muted-foreground">
            ¿Ya tienes cuenta? <Link to="/login" className="font-semibold text-primary hover:underline">Inicia sesión</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
