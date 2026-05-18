# Ocean Task Master - Documentación de Instalación y Configuración

## 🚀 Inicio Rápido

### 1. Prerequisitos

- Node.js 18+
- npm o yarn
- Cuenta Supabase
- Variables de entorno configuradas

### 2. Configuración de Variables de Entorno

Crea un archivo `.env.local` en la raíz del proyecto:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=tu-anon-key
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_KEY=tu-service-role-key
```

Obtén estas claves en:
- **Supabase Dashboard** → Settings → API

### 3. Instalar Dependencias

```bash
npm install
```

### 4. Ejecutar las Migraciones SQL

En **Supabase Console → SQL Editor**, ejecuta los scripts en este orden:

1. `supabase/migrations/001_create_task_subtasks.sql`
2. `supabase/migrations/002_create_task_comments.sql`
3. `supabase/migrations/003_fix_rls_policies.sql`
4. `supabase/migrations/004_create_rpc_create_project.sql`
5. `supabase/migrations/005_fix_tasks_rls.sql`

### 5. Seed de Base de Datos (Crear Usuario Demo)

```bash
SUPABASE_URL="https://tu-proyecto.supabase.co" \
SUPABASE_SERVICE_KEY="tu-service-role-key" \
node scripts/seed.js
```

**⚠️ Importante:** El `SUPABASE_SERVICE_KEY` debe ser la **Service Role Key** desde Supabase Settings → API

### 6. Regenerar Types TypeScript

```bash
# Opción 1: Si tienes Supabase CLI instalado
supabase gen types typescript --linked > src/integrations/supabase/types.ts

# Opción 2: Descargar manualmente desde Supabase Dashboard
# → Database → SQL Editor → Generar tipos
```

### 7. Ejecutar el Proyecto

```bash
npm run dev
```

Abre `http://localhost:5173` en tu navegador.

---

## 📚 Credenciales de Demo

Después de ejecutar el seed, puedes iniciar sesión con:

- **Email:** `admin@ocean-task-master.demo`
- **Contraseña:** `Admin123`

## 📋 Estructura del Proyecto

```
ocean-task-master/
├── src/
│   ├── components/          # Componentes React
│   │   ├── GanttChart.tsx
│   │   ├── TaskDetails.tsx
│   │   ├── ProjectDetailView.tsx
│   │   └── ui/              # Componentes UI (Button, Card, etc)
│   ├── hooks/               # React Query hooks
│   │   ├── use-projects.ts
│   │   ├── use-tasks.ts
│   │   ├── use-subtasks-and-comments.ts
│   │   ├── use-ai-summaries.ts
│   │   └── use-auth.ts
│   ├── integrations/
│   │   └── supabase/
│   │       ├── client.ts
│   │       └── types.ts
│   ├── routes/              # TanStack Router pages
│   │   ├── login.tsx
│   │   ├── _authenticated.dashboard.tsx
│   │   ├── _authenticated.projects.new.tsx
│   │   └── _authenticated.projects.$projectId.tsx
│   ├── styles.css
│   └── main.tsx
├── supabase/
│   └── migrations/          # Scripts SQL
├── scripts/
│   └── seed.js              # Script de seed
└── package.json
```

---

## 🔐 Políticas de Seguridad (RLS)

El proyecto tiene Row Level Security (RLS) habilitado en todas las tablas:

### projects
- ✅ SELECT: Usuarios ven solo proyectos donde son miembros
- ✅ INSERT: Usuarios autenticados pueden crear proyectos
- ✅ UPDATE: Solo administradores del proyecto
- ✅ DELETE: Solo administradores del proyecto

### project_members
- ✅ SELECT: Ver miembros de tus proyectos
- ✅ INSERT: Solo administradores pueden agregar miembros
- ✅ UPDATE: Solo administradores
- ✅ DELETE: Administradores (excepto último admin)

### tasks
- ✅ SELECT: Ver tareas de tus proyectos
- ✅ INSERT: Solo administradores
- ✅ UPDATE: Administradores y colaboradores asignados
- ✅ DELETE: Solo administradores

### task_subtasks & task_comments
- ✅ Heredan permisos del proyecto

---

## 🎯 Características Implementadas

### ✅ Completadas

- [x] Corrección de RLS en projects table
- [x] RPC segura para crear proyectos
- [x] Tablas task_subtasks y task_comments
- [x] Usuario admin demo
- [x] Proyecto demo con 11 tareas
- [x] Gantt Chart funcional
- [x] Task Details con subtasks
- [x] Sistema de comentarios de progreso
- [x] Resumen IA automático
- [x] Login mejorado con demo credentials

### ⏳ Próximas Mejoras

- [ ] Calendario interactivo
- [ ] Gestión de miembros
- [ ] Notificaciones en tiempo real
- [ ] Exportar a PDF/Excel
- [ ] Integración con APIs de IA
- [ ] Modo oscuro

---

## 🔧 Troubleshooting

### Error: "new row violates row-level security policy"

**Solución:** Ejecuta las migraciones SQL en orden. Asegúrate de que:

1. La tabla `project_members` existe
2. El trigger `auto_add_project_creator_as_admin` está activo
3. Las políticas RLS están correctas

Verifica en Supabase → Authentication → Policies

### Error: "RPC function not found"

**Solución:** Ejecuta la migración `004_create_rpc_create_project.sql`

### No se ven los tipos TypeScript

**Solución:** Regenera los tipos:

```bash
supabase gen types typescript --linked > src/integrations/supabase/types.ts
```

### Error de CORS en el seed script

**Solución:** Verifica que estés usando `SUPABASE_SERVICE_KEY` (no la anon key)

---

## 📞 Soporte

Si encuentras problemas:

1. Verifica que todas las migraciones se ejecutaron
2. Comprueba que las variables de entorno están configuradas
3. Revisa los logs en la consola del navegador
4. Consulta la documentación de Supabase: https://supabase.com/docs

---

## 📄 Licencia

Este proyecto es parte de Ocean Task Master.
