import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ListChecks, Loader2 } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Iniciar sesión — Ocean Task Master" }] }),
  component: LoginPage,
});

const schema = z.object({
  email: z.string().trim().email("Email inválido").max(255),
  password: z.string().min(6, "Mínimo 6 caracteres").max(72),
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("¡Bienvenido de nuevo!");
    navigate({ to: "/dashboard" });
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
          <h2 className="text-4xl font-bold leading-tight">Tu productividad en azul.</h2>
          <p className="mt-4 text-white/80 max-w-md">Gestiona tus tareas con una interfaz moderna y profesional. Cada cambio se guarda automáticamente.</p>
        </div>
        <p className="text-xs text-white/60">© {new Date().getFullYear()} Ocean Task Master</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 flex justify-center">
            <Link to="/" className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundImage: "var(--gradient-primary)" }}>
                <ListChecks className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-lg font-bold">Ocean Task Master</span>
            </Link>
          </div>
          <h1 className="text-3xl font-bold">Bienvenido</h1>
          <p className="mt-2 text-sm text-muted-foreground">Inicia sesión para gestionar tus tareas.</p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div>
              <label className="text-sm font-medium">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                className="mt-1.5 w-full rounded-lg border border-input bg-card px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring transition" />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Contraseña</label>
                <Link to="/forgot-password" className="text-xs font-medium text-primary hover:underline">
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                className="mt-1.5 w-full rounded-lg border border-input bg-card px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring transition" />
            </div>
            <button disabled={loading} type="submit"
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 disabled:opacity-60"
              style={{ backgroundImage: "var(--gradient-primary)", boxShadow: "var(--shadow-elegant)" }}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Iniciar sesión
            </button>
          </form>

          <p className="mt-6 text-sm text-center text-muted-foreground">
            ¿No tienes cuenta? <Link to="/signup" className="font-semibold text-primary hover:underline">Crear cuenta</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
