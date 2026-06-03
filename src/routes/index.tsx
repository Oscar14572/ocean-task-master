import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, ListChecks, Sparkles, Shield, Zap } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ocean Task Master — Gestor de tareas en la nube" },
      { name: "description", content: "Organiza tus tareas con un dashboard moderno. Autenticación segura, datos por usuario y diseño profesional en azul." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="border-b border-border/50 backdrop-blur-sm bg-background/80 sticky top-0 z-50">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundImage: "var(--gradient-primary)" }}>
              <ListChecks className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight">Ocean Task Master</span>
          </Link>
          <nav className="flex items-center gap-2">
            <Link to="/login" className="rounded-md px-4 py-2 text-sm font-medium text-foreground hover:bg-accent/20 transition-colors">Iniciar sesión</Link>
            <Link to="/signup" className="rounded-md px-4 py-2 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 hover:shadow-lg" style={{ backgroundImage: "var(--gradient-primary)", boxShadow: "var(--shadow-elegant)" }}>
              Crear cuenta
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 opacity-30" style={{ backgroundImage: "var(--gradient-hero)" }} />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-background/60 to-background" />
        <div className="container mx-auto px-4 pt-20 pb-32 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-medium text-primary mb-8">
            <Sparkles className="h-3.5 w-3.5" /> Diseñado para la productividad
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight max-w-4xl mx-auto leading-tight">
            Tu día, organizado con{" "}
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-primary)" }}>
              Ocean Task Master
            </span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Ocean Task Master es un gestor de tareas profesional con autenticación, prioridades, filtros y estadísticas en tiempo real. Privado, rápido y elegante.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link to="/signup" className="rounded-lg px-6 py-3 text-base font-semibold text-primary-foreground transition-all hover:scale-[1.02] hover:shadow-xl" style={{ backgroundImage: "var(--gradient-primary)", boxShadow: "var(--shadow-elegant)" }}>
              Empezar gratis
            </Link>
            <Link to="/login" className="rounded-lg border border-border bg-card px-6 py-3 text-base font-semibold transition-colors hover:bg-accent/10">
              Tengo cuenta
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 pb-24">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { icon: Shield, title: "Privado por diseño", desc: "Cada usuario solo accede a sus propias tareas. Seguridad a nivel de base de datos." },
            { icon: Zap, title: "Sincronización instantánea", desc: "Cambios reflejados inmediatamente. Estados de carga y errores bien manejados." },
            { icon: CheckCircle2, title: "Filtros y estadísticas", desc: "Filtra por estado, prioridad y búsqueda. Mira tu progreso de un vistazo." },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border border-border bg-card p-6 transition-all hover:shadow-lg hover:-translate-y-1" style={{ backgroundImage: "var(--gradient-card)" }}>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary mb-4">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border/50 py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Ocean Task Master
      </footer>
    </div>
  );
}
