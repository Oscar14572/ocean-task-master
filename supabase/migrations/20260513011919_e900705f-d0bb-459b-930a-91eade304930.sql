
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'pendiente' check (status in ('pendiente','en progreso','completada')),
  priority text not null default 'media' check (priority in ('baja','media','alta')),
  due_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_user_id_idx on public.tasks(user_id);

alter table public.tasks enable row level security;

create policy "Users can view their own tasks" on public.tasks for select using (auth.uid() = user_id);
create policy "Users can create their own tasks" on public.tasks for insert with check (auth.uid() = user_id);
create policy "Users can update their own tasks" on public.tasks for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete their own tasks" on public.tasks for delete using (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tasks_set_updated_at before update on public.tasks
for each row execute function public.set_updated_at();
