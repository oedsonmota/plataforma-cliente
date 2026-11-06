-- v2: foto do cliente, entrega final e depoimentos

-- ========== novas colunas no projeto ==========
alter table public.projects add column if not exists photo_url text not null default '';
alter table public.projects add column if not exists testimonial_open boolean not null default false;

-- ========== entrega final ==========
create table if not exists public.final_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects on delete cascade,
  position int not null default 0,
  name text not null default '',
  description text not null default '',
  format text not null default '',
  file_url text not null default ''
);
create index if not exists final_items_project_idx on public.final_items (project_id, position);
alter table public.final_items enable row level security;
drop policy if exists "admin gerencia entrega final" on public.final_items;
create policy "admin gerencia entrega final" on public.final_items for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- itens padrão para projetos que ainda não têm
insert into public.final_items (project_id, position, name, description, format)
select p.id, v.pos, v.name, v.description, v.format
from public.projects p
cross join (values
  (0, 'Guia de marca', 'O manual com todas as regras de uso da identidade visual e verbal.', 'PDF'),
  (1, 'Logotipos', 'Todas as versões do logo, para fundo claro e escuro.', 'PNG, SVG e PDF'),
  (2, 'Cores e tipografia', 'Os códigos das cores e as fontes da marca, prontos para usar.', 'PDF e arquivos de fonte'),
  (3, 'Grafismos e elementos visuais', 'Padrões, ícones e elementos de apoio da identidade.', 'PNG e SVG'),
  (4, 'Plataforma de marca', 'Posicionamento, promessa, personalidade e tom de voz num só documento.', 'PDF'),
  (5, 'Aplicações da marca', 'A marca aplicada em peças reais, para servir de referência.', 'PNG e PDF')
) as v(pos, name, description, format)
where not exists (select 1 from public.final_items f where f.project_id = p.id);

-- ========== depoimentos ==========
create table if not exists public.testimonials (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects on delete cascade,
  client_user_id uuid references auth.users on delete set null,
  kind text not null check (kind in ('texto','video','audio')),
  body text not null default '',
  file_path text not null default '',
  created_at timestamptz not null default now()
);
alter table public.testimonials enable row level security;
drop policy if exists "admin gerencia depoimentos" on public.testimonials;
create policy "admin gerencia depoimentos" on public.testimonials for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "cliente envia o proprio depoimento" on public.testimonials;
create policy "cliente envia o proprio depoimento" on public.testimonials for insert to authenticated
  with check (client_user_id = auth.uid() and exists (select 1 from public.projects p where p.id = project_id and p.client_user_id = auth.uid()));
drop policy if exists "cliente ve o proprio depoimento" on public.testimonials;
create policy "cliente ve o proprio depoimento" on public.testimonials for select to authenticated using (client_user_id = auth.uid());

grant select, insert, update, delete on public.final_items, public.testimonials to authenticated;
revoke all on public.final_items, public.testimonials from anon;

-- ========== o que o cliente recebe (versão 2) ==========
create or replace function public.get_my_project() returns json
language sql security definer set search_path = public stable as $$
  select json_build_object(
    'id', p.id, 'contact_name', p.contact_name, 'brand_name', p.brand_name,
    'title', p.title, 'description', p.description, 'whatsapp', p.whatsapp,
    'photo_url', p.photo_url, 'updated_at', p.updated_at,
    'testimonial_open', p.testimonial_open or not exists (select 1 from public.steps s where s.project_id = p.id and s.status <> 'concluida'),
    'steps', coalesce((
      select json_agg(json_build_object(
        'id', s.id, 'name', s.name, 'phase', s.phase, 'description', s.description,
        'deliverable', s.deliverable, 'client_action', s.client_action,
        'start_date', s.start_date, 'end_date', s.end_date, 'status', s.status,
        'file_url', case when s.status = 'concluida' then s.file_url else '' end
      ) order by s.position)
      from public.steps s where s.project_id = p.id), '[]'::json),
    'final_items', coalesce((
      select json_agg(json_build_object('id', f.id, 'name', f.name, 'description', f.description, 'format', f.format, 'file_url', f.file_url) order by f.position)
      from public.final_items f where f.project_id = p.id), '[]'::json),
    'testimonials', coalesce((
      select json_agg(json_build_object('id', t.id, 'kind', t.kind, 'created_at', t.created_at) order by t.created_at desc)
      from public.testimonials t where t.project_id = p.id and t.client_user_id = auth.uid()), '[]'::json)
  )
  from public.projects p
  where p.client_user_id = auth.uid()
  order by p.created_at desc
  limit 1;
$$;
revoke all on function public.get_my_project() from public, anon;
grant execute on function public.get_my_project() to authenticated;

-- ========== armazenamento de arquivos ==========
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('depoimentos', 'depoimentos', false, 52428800,
  array['video/mp4','video/quicktime','video/webm','video/3gpp','audio/mpeg','audio/mp4','audio/webm','audio/ogg','audio/x-m4a','audio/m4a','audio/aac','audio/wav','audio/x-wav'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "fotos: admin envia" on storage.objects;
create policy "fotos: admin envia" on storage.objects for insert to authenticated with check (bucket_id = 'fotos' and public.is_admin());
drop policy if exists "fotos: admin altera" on storage.objects;
create policy "fotos: admin altera" on storage.objects for update to authenticated using (bucket_id = 'fotos' and public.is_admin());
drop policy if exists "fotos: admin apaga" on storage.objects;
create policy "fotos: admin apaga" on storage.objects for delete to authenticated using (bucket_id = 'fotos' and public.is_admin());

drop policy if exists "depoimentos: cliente envia na propria pasta" on storage.objects;
create policy "depoimentos: cliente envia na propria pasta" on storage.objects for insert to authenticated
  with check (bucket_id = 'depoimentos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "depoimentos: dono e admin leem" on storage.objects;
create policy "depoimentos: dono e admin leem" on storage.objects for select to authenticated
  using (bucket_id = 'depoimentos' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
drop policy if exists "depoimentos: admin apaga" on storage.objects;
create policy "depoimentos: admin apaga" on storage.objects for delete to authenticated using (bucket_id = 'depoimentos' and public.is_admin());
