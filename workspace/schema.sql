-- =====================================================================
-- AQcredix Workspace — Supabase schema
-- Run this whole file once in the Supabase SQL Editor.
--
-- Security model: every row belongs to an organisation. Row-level security
-- means a signed-in user can only ever see rows for THEIR organisation, and
-- only editors and above can write. This is enforced by Postgres itself, not
-- by the browser, so it holds even if someone calls the API directly.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------- organisations ----------
create table if not exists public.orgs (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  plan        text not null default 'trial',
  seats       int  not null default 5,
  created_at  timestamptz not null default now()
);

-- ---------- members (a user's seat in an org) ----------
-- role: owner > admin > editor > viewer
create table if not exists public.members (
  id          text primary key,
  org_id      uuid references public.orgs(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete cascade,
  email       text not null,
  name        text,
  role        text not null default 'viewer',
  department  text,
  status      text not null default 'active',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists members_org_idx  on public.members(org_id);
create index if not exists members_user_idx on public.members(user_id);

-- ---------- element readiness ----------
create table if not exists public.elements (
  id          text not null,                    -- the NABH code, e.g. 'AAC.1.a'
  org_id      uuid references public.orgs(id) on delete cascade,
  status      text not null default 'unassessed',  -- compliant|partial|nc|na|unassessed
  evidence    text,
  owner       text,
  department  text,
  due_date    date,
  updated_by  uuid references auth.users(id),
  updated_at  timestamptz not null default now(),
  primary key (org_id, id)
);
create index if not exists elements_org_idx on public.elements(org_id);

-- ---------- non-conformities and CAPA ----------
create table if not exists public.capa (
  id            text primary key,
  org_id        uuid references public.orgs(id) on delete cascade,
  title         text not null,
  element_code  text,
  source        text,          -- gap analysis | mock survey | internal audit | incident | external
  severity      text default 'minor',   -- observation | minor | major | critical
  department    text,
  root_cause    text,
  corrective    text,
  preventive    text,
  owner         text,
  due_date      date,
  status        text default 'open',    -- open | in_progress | completed | verified | closed
  verification  text,
  verified_on   date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists capa_org_idx on public.capa(org_id);

-- ---------- document control (IMS.6.a) ----------
create table if not exists public.documents (
  id            text primary key,
  org_id        uuid references public.orgs(id) on delete cascade,
  doc_code      text,
  title         text not null,
  doc_type      text,          -- policy | sop | manual | form | plan | record
  department    text,
  version       text default '1.0',
  status        text default 'draft',   -- draft | under_review | approved | obsolete
  author        text,
  approver      text,
  effective_date date,
  review_date   date,
  elements      text,          -- comma-separated NABH codes this document evidences
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists documents_org_idx on public.documents(org_id);

-- ---------- version history: document control needs an audit trail ----------
create table if not exists public.document_versions (
  id           uuid primary key default gen_random_uuid(),
  document_id  text references public.documents(id) on delete cascade,
  org_id       uuid references public.orgs(id) on delete cascade,
  version      text,
  status       text,
  changed_by   uuid references auth.users(id),
  change_note  text,
  created_at   timestamptz not null default now()
);

-- =====================================================================
-- Helper functions
-- =====================================================================

-- The org of the currently signed-in user.
create or replace function public.my_org()
returns uuid language sql stable security definer set search_path = public as $$
  select org_id from public.members where user_id = auth.uid() limit 1;
$$;

-- True when the signed-in user may write.
create or replace function public.can_edit()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.members
    where user_id = auth.uid() and role in ('owner','admin','editor')
  );
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.members
    where user_id = auth.uid() and role in ('owner','admin')
  );
$$;

-- =====================================================================
-- On signup: create the org and make the first user its owner.
-- =====================================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare new_org uuid;
begin
  insert into public.orgs (name)
  values (coalesce(new.raw_user_meta_data->>'org_name', 'My Hospital'))
  returning id into new_org;

  insert into public.members (id, org_id, user_id, email, name, role, status)
  values ('mem_' || replace(new.id::text,'-',''), new_org, new.id, new.email,
          coalesce(new.raw_user_meta_data->>'name', new.email), 'owner', 'active');
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- Row-level security
-- =====================================================================
-- =====================================================================
-- Internal audit: one row per department audit, many per user.
-- Findings ride along as a JSON payload rather than a child table. That is a
-- deliberate trade: an audit is written and read as a whole, never queried
-- element-by-element across audits, so a child table would buy joins nobody
-- performs at the cost of a second RLS surface. Findings that need tracking
-- individually are written into public.capa on finish, which is where closure
-- actually lives.
-- =====================================================================
create table if not exists public.audits (
  id               text primary key,
  org_id           uuid references public.orgs(id) on delete cascade,
  department_id    text not null,
  department_name  text not null,
  auditor_id       uuid references auth.users(id),
  auditor_name     text not null,
  started_at       timestamptz not null,
  finished_at      timestamptz,
  duration_seconds int,
  paused_seconds   int not null default 0,
  status           text not null default 'in_progress',   -- in_progress | completed
  total_elements   int,
  compliant        int,
  partial          int,
  nc               int,
  na               int,
  readiness_score  numeric,
  payload          jsonb,        -- { findings: {...}, kpi_checks: {...} }
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists audits_org_dept_idx on public.audits (org_id, department_id, started_at desc);

-- =====================================================================
-- Incident reporting. One row per reported patient-safety event.
-- The full form rides in `payload` for the same reason audits do: an incident is written
-- and read whole. The columns lifted out are the ones the register filters, sorts and
-- charts on, so those queries never have to open the JSON.
--
-- occurred_at vs submitted_at is deliberate and load-bearing: the gap between them is the
-- reporting delay, which is the single most useful number about a reporting culture and
-- is lost forever if only one timestamp is stored.
-- =====================================================================
create table if not exists public.incidents (
  id             text primary key,
  org_id         uuid references public.orgs(id) on delete cascade,
  reference      text not null,
  occurred_at    timestamptz,
  reported_at    timestamptz,
  submitted_at   timestamptz,
  department     text,
  classification text,          -- near_miss | no_harm | adverse | sentinel | other
  severity       int,           -- 1..4, derived from classification
  status         text not null default 'reported',
  reporter_name  text,
  closed_at      timestamptz,
  payload        jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists incidents_org_time_idx
  on public.incidents (org_id, occurred_at desc);

alter table public.orgs              enable row level security;
alter table public.members           enable row level security;
alter table public.elements          enable row level security;
alter table public.capa              enable row level security;
alter table public.documents         enable row level security;
alter table public.document_versions enable row level security;
alter table public.audits            enable row level security;
alter table public.incidents         enable row level security;

drop policy if exists org_read on public.orgs;
create policy org_read on public.orgs
  for select using (id = public.my_org());
drop policy if exists org_write on public.orgs;
create policy org_write on public.orgs
  for update using (id = public.my_org() and public.is_admin());

drop policy if exists members_read on public.members;
create policy members_read on public.members
  for select using (org_id = public.my_org());
drop policy if exists members_write on public.members;
create policy members_write on public.members
  for all using (org_id = public.my_org() and public.is_admin())
  with check (org_id = public.my_org() and public.is_admin());

-- Same shape for every org-scoped content table.
do $$
declare t text;
begin
  foreach t in array array['elements','capa','documents','document_versions','audits','incidents'] loop
    execute format('drop policy if exists %I_read on public.%I', t, t);
    execute format(
      'create policy %I_read on public.%I for select using (org_id = public.my_org())', t, t);

    execute format('drop policy if exists %I_write on public.%I', t, t);
    execute format(
      'create policy %I_write on public.%I for all
         using (org_id = public.my_org() and public.can_edit())
         with check (org_id = public.my_org() and public.can_edit())', t, t);
  end loop;
end $$;

-- =====================================================================
-- Stamp org_id automatically so the client never has to send it.
-- =====================================================================
create or replace function public.set_org_id()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.org_id is null then new.org_id := public.my_org(); end if;
  return new;
end; $$;

do $$
declare t text;
begin
  foreach t in array array['elements','capa','documents','document_versions','members','audits','incidents'] loop
    execute format('drop trigger if exists set_org_%I on public.%I', t, t);
    execute format(
      'create trigger set_org_%I before insert on public.%I
         for each row execute function public.set_org_id()', t, t);
  end loop;
end $$;

-- =====================================================================
-- Record a version row whenever a document's version or status changes.
-- =====================================================================
create or replace function public.log_document_version()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT') or (old.version is distinct from new.version)
     or (old.status is distinct from new.status) then
    insert into public.document_versions (document_id, org_id, version, status, changed_by)
    values (new.id, new.org_id, new.version, new.status, auth.uid());
  end if;
  return new;
end; $$;

drop trigger if exists doc_version_log on public.documents;
create trigger doc_version_log
  after insert or update on public.documents
  for each row execute function public.log_document_version();

-- =====================================================================
-- Subscriptions. One row per purchase attempt.
--
-- Row-level security here is different from every other table: a subscription belongs to
-- a USER, not to an org, and a user must be able to read their own row before any org
-- membership exists. So the read policy is keyed on auth.uid(), and INSERT is allowed
-- only for one's own row with status 'pending'.
--
-- Critically, ordinary users must NOT be able to UPDATE their own row — otherwise anyone
-- could set status='active' and grant themselves free access. Approval is an owner-only
-- operation, enforced below.
-- =====================================================================
create table if not exists public.subscriptions (
  id            text primary key,
  user_id       uuid references auth.users(id) on delete cascade,
  email         text,
  name          text,
  plan          text not null,
  months        int  not null default 1,
  amount_paise  int  not null default 0,
  method        text not null default 'upi_manual',
  txn_ref       text,
  note          text,
  status        text not null default 'pending',   -- pending | active | rejected
  requested_at  timestamptz not null default now(),
  activated_at  timestamptz,
  expires_at    timestamptz,
  approved_by   text,
  created_at    timestamptz not null default now(),
  -- store.js stamps updated_at on every write, so every table it touches must have it.
  updated_at    timestamptz not null default now()
);

-- For anyone who created this table before updated_at was added: `create table if not
-- exists` will not alter an existing table, so add the column explicitly. Safe to re-run.
alter table public.subscriptions add column if not exists updated_at timestamptz not null default now();

create index if not exists subscriptions_user_idx on public.subscriptions (user_id, status, expires_at desc);

alter table public.subscriptions enable row level security;

-- Who counts as an owner. Keep this list in step with ownerEmails in billing-config.js.
create or replace function public.aq_is_owner() returns boolean
language sql stable as $$
  select coalesce(
    (select lower(auth.jwt() ->> 'email') in ('sgsanthoshkumar18@gmail.com')),
    false);
$$;

drop policy if exists subscriptions_read on public.subscriptions;
create policy subscriptions_read on public.subscriptions
  for select using (user_id = auth.uid() or public.aq_is_owner());

drop policy if exists subscriptions_insert on public.subscriptions;
create policy subscriptions_insert on public.subscriptions
  for insert with check (
    user_id = auth.uid() and status = 'pending'
  );

-- Only an owner may activate, extend or reject. This is the line that makes the paywall
-- real: without it a user could PATCH their own row to active and pay nothing.
drop policy if exists subscriptions_update on public.subscriptions;
create policy subscriptions_update on public.subscriptions
  for update using (public.aq_is_owner()) with check (public.aq_is_owner());

drop policy if exists subscriptions_delete on public.subscriptions;
create policy subscriptions_delete on public.subscriptions
  for delete using (public.aq_is_owner());

