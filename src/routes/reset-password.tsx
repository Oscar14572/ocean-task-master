import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ListChecks, Loader2 } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Nueva contraseña — Ocean Task Master" }] }),
  component: ResetPasswordPage,
});

const schema = z
  .object({
    password: z.string().min(6, "Mínimo 6 caracteres").max(72),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Las contraseñas no coinciden",
    path: ["confirm"],
  });

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase coloca tokens de recovery en el hash y dispara PASSWORD_RECOVERY
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ password, confirm });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Contraseña actualizada. Inicia sesión con tu nueva contraseña.");
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div
        className="hidden lg:flex flex-col justify-between p-12 text-sidebar-foreground"
        style={{ backgroundImage: "var(--gradient-hero)" }}
      >
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/15 backdrop-blur">
            <ListChecks className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold">Ocean Task Master</span>
        </Link>
        <div>
          <h2 className="text-4xl font-bold leading-tight">Crea una nueva contraseña.</h2>
          <p className="mt-4 text-white/80 max-w-md">
            Elige una contraseña segura para proteger tu cuenta y tus proyectos.
          </p>
        </div>
        <p className="text-xs text-white/60">© {new Date().getFullYear()} Ocean Task Master</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <h1 className="text-3xl font-bold">Restablecer contraseña</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Ingresa una nueva contraseña para tu cuenta.
          </p>

          {!ready ? (
            <div className="mt-8 rounded-lg border border-input bg-card p-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin inline-block mr-2" />
              Validando enlace de recuperación...
            </div>
          ) : (
            <form onSubmit={onSubmit} className="mt-8 space-y-4">
              <div>
                <label className="text-sm font-medium">Nueva contraseña</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="mt-1.5 w-full rounded-lg border border-input bg-card px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring transition"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Confirmar contraseña</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={6}
                  className="mt-1.5 w-full rounded-lg border border-input bg-card px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring transition"
                />
              </div>
              <button
                disabled={loading}
                type="submit"
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 disabled:opacity-60"
                style={{
                  backgroundImage: "var(--gradient-primary)",
                  boxShadow: "var(--shadow-elegant)",
                }}
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Guardar nueva contraseña
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
