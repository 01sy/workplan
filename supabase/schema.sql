create extension if not exists pgcrypto;

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  title text not null check (char_length(title) between 1 and 240),
  description text not null default '',
  owner_name text not null default '',
  status text not null default '待开始' check (status in ('待开始', '进行中', '已停滞', '已完成')),
  priority text not null default '不紧急不重要' check (priority in ('重要紧急', '重要不紧急', '紧急不重要', '不紧急不重要')),
  category text not null default 'work' check (category in ('work', 'personal')),
  start_at timestamptz,
  due_at timestamptz,
  completed_at timestamptz,
  latest_update text not null default '',
  completion_criteria text not null default '',
  source_record_id text unique,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 12000),
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  task_id uuid references public.tasks(id) on delete set null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at before update on public.tasks
for each row execute function public.set_updated_at();

alter table public.tasks enable row level security;
alter table public.chat_messages enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "tasks own rows" on public.tasks;
create policy "tasks own rows" on public.tasks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "chat own rows" on public.chat_messages;
create policy "chat own rows" on public.chat_messages for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "audit own rows" on public.audit_logs;
create policy "audit own rows" on public.audit_logs for select using (auth.uid() = user_id);

create index if not exists tasks_user_due_idx on public.tasks(user_id, due_at) where archived_at is null;
create index if not exists tasks_user_status_idx on public.tasks(user_id, status) where archived_at is null;

