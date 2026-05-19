import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ListChecks, Loader2 } from "lucide-react";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Recuperar contraseña — Aqua Tasks" }] }),
  component: ForgotPasswordPage,
});

const schema = z.object({
  email: z.string().trim().email("Email inválido").max(255),
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
    toast.success("Si el email existe, recibirás instrucciones para restablecer la contraseña.");
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
          <span className="text-lg font-bold">Aqua Tasks</span>
        </Link>
        <div>
          <h2 className="text-4xl font-bold leading-tight">Recupera el acceso.</h2>
          <p className="mt-4 text-white/80 max-w-md">
            Te enviaremos un enlace seguro para que crees una nueva contraseña en segundos.
          </p>
        </div>
        <p className="text-xs text-white/60">© {new Date().getFullYear()} Aqua Tasks</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <h1 className="text-3xl font-bold">¿Olvidaste tu contraseña?</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Ingresa tu email y te enviaremos un enlace para restablecerla.
          </p>

          {sent ? (
            <div className="mt-8 rounded-lg border border-input bg-card p-6 text-sm">
              <p className="font-medium">📬 Revisa tu bandeja de entrada</p>
              <p className="mt-2 text-muted-foreground">
                Si <strong>{email}</strong> está asociado a una cuenta, recibirás un correo con un
                enlace para restablecer tu contraseña. No olvides revisar la carpeta de spam.
              </p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="mt-8 space-y-4">
              <div>
                <label className="text-sm font-medium">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
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
                Enviar enlace
              </button>
            </form>
          )}

          <p className="mt-6 text-sm text-center text-muted-foreground">
            ¿Recordaste tu contraseña?{" "}
            <Link to="/login" className="font-semibold text-primary hover:underline">
              Inicia sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
