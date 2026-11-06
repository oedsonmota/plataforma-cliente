-- Plataforma do cliente Edson Mota: tabelas, regras de acesso e funções
-- Rodar inteiro no SQL Editor do Supabase.

-- ========== perfis ==========
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  role text not null default 'client' check (role in ('admin','client')),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create or replace function public.is_admin() returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

drop policy if exists "ver o proprio perfil" on public.profiles;
create policy "ver o proprio perfil" on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists "admin gerencia perfis" on public.profiles;
create policy "admin gerencia perfis" on public.profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- o primeiro usuário criado vira admin; todos os outros são clientes
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, role)
  values (new.id, case when exists (select 1 from public.profiles where role = 'admin') then 'client' else 'admin' end)
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- perfis para usuários que já existiam antes deste script
insert into public.profiles (id, role)
select u.id, 'client' from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

-- ========== projetos ==========
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  client_user_id uuid references auth.users on delete set null,
  client_email text not null default '',
  contact_name text not null default '',
  brand_name text not null default '',
  title text not null default '',
  description text not null default '',
  whatsapp text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.projects enable row level security;
drop policy if exists "admin gerencia projetos" on public.projects;
create policy "admin gerencia projetos" on public.projects for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ========== etapas ==========
create table if not exists public.steps (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects on delete cascade,
  position int not null default 0,
  name text not null default '',
  phase text not null default 'Estratégia',
  description text not null default '',
  deliverable text not null default '',
  client_action text not null default '',
  start_date date not null,
  end_date date not null,
  status text not null default 'afazer' check (status in ('afazer','andamento','concluida')),
  file_url text not null default ''
);
create index if not exists steps_project_idx on public.steps (project_id, position);
alter table public.steps enable row level security;
drop policy if exists "admin gerencia etapas" on public.steps;
create policy "admin gerencia etapas" on public.steps for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- "Atualizado em" do portal acompanha qualquer mudança nas etapas
create or replace function public.touch_project() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.projects set updated_at = now() where id = coalesce(new.project_id, old.project_id);
  return null;
end $$;
drop trigger if exists steps_touch on public.steps;
create trigger steps_touch after insert or update or delete on public.steps
for each row execute function public.touch_project();

-- ========== o que o cliente enxerga ==========
-- O cliente não lê as tabelas direto. Ele recebe só o próprio projeto,
-- e o link do arquivo só aparece quando a etapa está concluída.
create or replace function public.get_my_project() returns json
language sql security definer set search_path = public stable as $$
  select json_build_object(
    'id', p.id, 'contact_name', p.contact_name, 'brand_name', p.brand_name,
    'title', p.title, 'description', p.description, 'whatsapp', p.whatsapp,
    'updated_at', p.updated_at,
    'steps', coalesce((
      select json_agg(json_build_object(
        'id', s.id, 'name', s.name, 'phase', s.phase, 'description', s.description,
        'deliverable', s.deliverable, 'client_action', s.client_action,
        'start_date', s.start_date, 'end_date', s.end_date, 'status', s.status,
        'file_url', case when s.status = 'concluida' then s.file_url else '' end
      ) order by s.position)
      from public.steps s where s.project_id = p.id), '[]'::json)
  )
  from public.projects p
  where p.client_user_id = auth.uid()
  order by p.created_at desc
  limit 1;
$$;
revoke all on function public.get_my_project() from public, anon;
grant execute on function public.get_my_project() to authenticated;

-- ========== permissões da API ==========
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.projects, public.steps to authenticated;
grant select on public.profiles to authenticated;
revoke all on public.projects, public.steps, public.profiles from anon;
