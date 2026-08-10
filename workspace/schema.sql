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
-- Site settings. Owner-controlled values that every visitor reads.
--
-- The palette lives here so that the owner's choice reaches subscribers: switching to
-- neon is a decision about how the product looks to everyone, not a per-browser
-- preference. A signed-in user picks it up on their next page load; anyone already on a
-- page sees it when they navigate.
--
-- Readable by everyone including anonymous visitors — it holds nothing private, and the
-- palette has to apply before sign-in. Writable only by the owner, so a subscriber cannot
-- restyle the site for every other hospital.
-- =====================================================================
create table if not exists public.site_settings (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.site_settings enable row level security;

drop policy if exists site_settings_read on public.site_settings;
create policy site_settings_read on public.site_settings
  for select using (true);

-- One policy per command rather than "for all": an owner-only write must not be able to
-- widen the read rule by accident.
drop policy if exists site_settings_insert on public.site_settings;
create policy site_settings_insert on public.site_settings
  for insert with check (public.aq_is_owner());

drop policy if exists site_settings_update on public.site_settings;
create policy site_settings_update on public.site_settings
  for update using (public.aq_is_owner()) with check (public.aq_is_owner());

-- Seeded so the first read returns a row rather than nothing, which the client would
-- otherwise have to treat as an error it cannot distinguish from a failed request.
insert into public.site_settings (key, value)
values ('palette', '{"palette":"default"}'::jsonb)
on conflict (key) do nothing;

-- =====================================================================
-- Activity. One row per completed piece of work, tied to the USER.
--
-- This is what makes a subscriber's progress permanent: quizzes, certificates, videos,
-- gap analyses, mock surveys and SOPs previously existed only in the browser, so they
-- vanished on a new device or a cleared cache. A quality manager works from a ward
-- tablet, an office PC and a phone; the record has to be the same in all three.
--
-- SECURITY: this is keyed on auth.uid(), NOT on org, and deliberately so. Unlike audits
-- or incidents — which are the hospital's records and are shared with colleagues — a
-- person's learning history is their own. The policies below mean a row is visible only
-- to the account that created it: no other subscriber, no colleague in the same
-- hospital, and nobody without that account's email and password can read it. Even the
-- org's admins cannot, because org membership is not consulted anywhere in these rules.
--
-- user_id is set by the trigger below from auth.uid() rather than trusted from the
-- client, so a forged user_id in a request body cannot write a row into someone else's
-- history. The insert policy independently rejects a mismatched user_id as well; the two
-- together mean neither a bug in the client nor a hand-crafted request can cross accounts.
--
-- Rows are never updated, only inserted and read — an activity log that can be edited is
-- not a log. There is no delete policy for the same reason.
-- =====================================================================
create table if not exists public.activity (
  id         text primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  type       text not null,          -- quiz_completed | certificate_earned | video_watched | ...
  meta       jsonb not null default '{}'::jsonb,
  at         timestamptz not null default now(),
  created_at timestamptz not null default now(),
  -- store.js stamps updated_at on every write, so every table it touches must have it.
  updated_at timestamptz not null default now()
);

-- The profile page reads one user's rows ordered by time; without this index that is a
-- sequential scan of every subscriber's history on every page load.
create index if not exists activity_user_at_idx on public.activity(user_id, at desc);
-- Distinct-counting (certificates by serial, gap analyses by day) filters on type first.
create index if not exists activity_user_type_idx on public.activity(user_id, type);

alter table public.activity enable row level security;

-- Stamp the owner server-side. The client never sends user_id, and if it does, it is
-- overwritten — the JWT is the only authority on who is writing.
create or replace function public.set_activity_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.user_id := auth.uid();
  return new;
end; $$;

drop trigger if exists set_activity_user_trg on public.activity;
create trigger set_activity_user_trg before insert on public.activity
  for each row execute function public.set_activity_user();

-- Read your own history and nobody else's.
drop policy if exists activity_select on public.activity;
create policy activity_select on public.activity
  for select using (user_id = auth.uid());

-- Write only as yourself. Belt and braces with the trigger above.
drop policy if exists activity_insert on public.activity;
create policy activity_insert on public.activity
  for insert with check (user_id = auth.uid());

-- No update and no delete policy: with RLS enabled, the absence of a policy is a denial.
-- History is append-only, so a subscriber cannot quietly rewrite their own record before
-- an assessment, and a bug cannot wipe it.

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
--
-- Gmail ignores dots in the local part and anything after a '+', so s.g.name@gmail.com
-- and sgname@gmail.com are the same mailbox. The address is normalised the same way the
-- browser does it before comparing, so signing in with either spelling still grants owner
-- rights. Without this, the owner could be locked out of their own approval queue by the
-- punctuation of the address they happened to register with.
create or replace function public.aq_norm_email(raw text) returns text
language sql immutable as $$
  select case
    when split_part(lower(coalesce(raw, '')), '@', 2) in ('gmail.com', 'googlemail.com')
      then replace(split_part(split_part(lower(raw), '@', 1), '+', 1), '.', '') || '@gmail.com'
    else lower(coalesce(raw, ''))
  end;
$$;

-- Owner addresses live in a table, not in the body of a function. Editing a function
-- means re-running the whole schema; editing a row means one insert. Keep this in step
-- with ownerEmails in billing-config.js — the browser and the database each keep their
-- own copy of the list, and when the two disagree the panel renders Approve buttons that
-- the database then refuses. That disagreement is invisible without aq_whoami() below.
create table if not exists public.aq_owners (
  email_norm text primary key,
  added_at   timestamptz not null default now()
);

alter table public.aq_owners enable row level security;

-- Nobody reads this table from the browser. aq_is_owner() is security definer and reads
-- it on the caller's behalf, so no policy is needed and none is granted: an anonymous
-- visitor must not be able to enumerate who the owners are.
insert into public.aq_owners (email_norm)
values (public.aq_norm_email('s.g.santhoshkumar18@gmail.com'))
on conflict (email_norm) do nothing;

-- The signed-in address, hunted down in the three places it can hide.
--
-- The top-level 'email' claim is the normal case. It is absent for some providers and for
-- sessions minted before the claim was added, in which case the address is either in
-- user_metadata or nowhere in the token at all — hence the final lookup against
-- auth.users by uid, which is always authoritative. Reading auth.users requires elevated
-- rights, which is why the callers below are security definer.
create or replace function public.aq_jwt_email() returns text
language sql stable security definer set search_path = public, auth as $$
  select coalesce(
    nullif(auth.jwt() ->> 'email', ''),
    nullif(auth.jwt() -> 'user_metadata' ->> 'email', ''),
    (select u.email from auth.users u where u.id = auth.uid())
  );
$$;

-- security definer so it can reach auth.users through aq_jwt_email() and read aq_owners,
-- neither of which the anon role may touch directly. It returns a boolean and nothing
-- else, so it leaks no addresses.
create or replace function public.aq_is_owner() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select exists (
    select 1 from public.aq_owners o
    where o.email_norm = public.aq_norm_email(public.aq_jwt_email())
  );
$$;

-- Diagnostic. The SQL editor cannot answer "does the database think I am the owner?"
-- because the editor has no JWT — aq_is_owner() is false there no matter what, which has
-- already sent one debugging session down a blind alley. This function called from the
-- signed-in browser answers it truthfully, and the Access panel surfaces the result.
create or replace function public.aq_whoami() returns jsonb
language sql stable security definer set search_path = public, auth as $$
  select jsonb_build_object(
    'uid',            auth.uid(),
    'jwt_email',      auth.jwt() ->> 'email',
    'resolved_email', public.aq_jwt_email(),
    'normalised',     public.aq_norm_email(public.aq_jwt_email()),
    'is_owner',       public.aq_is_owner(),
    'owner_count',    (select count(*) from public.aq_owners)
  );
$$;

grant execute on function public.aq_whoami() to anon, authenticated;
grant execute on function public.aq_is_owner() to anon, authenticated;

drop policy if exists subscriptions_read on public.subscriptions;
create policy subscriptions_read on public.subscriptions
  for select using (user_id = auth.uid() or public.aq_is_owner());

-- store.js writes every row with PostgREST's upsert (INSERT ... ON CONFLICT DO UPDATE),
-- so an owner approving a claim arrives here as an INSERT of a row whose status is
-- 'active'. The original policy only permitted inserts with status 'pending', which
-- silently rejected every approval — the request simply stayed pending forever.
-- An owner may write any row; everyone else may still only lodge their own claim.
drop policy if exists subscriptions_insert on public.subscriptions;
create policy subscriptions_insert on public.subscriptions
  for insert with check (
    public.aq_is_owner()
    or (user_id = auth.uid() and status = 'pending')
  );

-- Only an owner may activate, extend or reject. This is the line that makes the paywall
-- real: without it a user could PATCH their own row to active and pay nothing.
drop policy if exists subscriptions_update on public.subscriptions;
create policy subscriptions_update on public.subscriptions
  for update using (public.aq_is_owner()) with check (public.aq_is_owner());

drop policy if exists subscriptions_delete on public.subscriptions;
create policy subscriptions_delete on public.subscriptions
  for delete using (public.aq_is_owner());


-- ---------- Complimentary accounts ----------
-- Lifetime free access, by address. These are guests of the platform, not operators:
-- aq_is_comp() is NOT aq_is_owner(), and nothing owner-gated consults it. Keep this list
-- in step with complimentaryEmails in billing/billing-config.js — that copy decides what
-- the browser shows, this one decides what the database will actually hand over, and the
-- database is the one that matters.
create or replace function public.aq_is_comp() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select public.aq_norm_email(public.aq_jwt_email()) in (
    public.aq_norm_email('mavisneha@gmail.com')
  );
$$;

grant execute on function public.aq_is_comp() to anon, authenticated;

-- A real row, so the account looks and behaves like any other active subscriber
-- everywhere — the profile page, the Access panel, any future report — rather than being
-- a special case each of those has to know about. Dated far out rather than null because
-- every expiry comparison in the code expects a date; a null would read as "no expiry
-- recorded" and fail closed.
--
-- user_id is left null: it is filled in the first time they sign in, by the trigger
-- below. It cannot be set here because the account may not exist yet.
insert into public.subscriptions
  (id, user_id, email, name, plan, months, amount_paise, method, status,
   requested_at, activated_at, expires_at, approved_by, note)
values
  ('sub_comp_mavisneha', null, 'mavisneha@gmail.com', 'Complimentary',
   'complimentary', 1200, 0, 'complimentary', 'active',
   now(), now(), now() + interval '100 years', 'owner',
   'Lifetime complimentary access granted by the owner.')
on conflict (id) do update
  set status = 'active',
      expires_at = excluded.expires_at,
      amount_paise = 0,
      method = 'complimentary';

-- Bind the complimentary row to the account the first time that person signs in, so the
-- normal user_id lookups find it. Without this the row is matched by email only, which
-- works but leaves user_id null forever.
create or replace function public.aq_claim_comp_subscription()
returns trigger language plpgsql security definer set search_path = public, auth as $$
begin
  update public.subscriptions
     set user_id = new.id
   where user_id is null
     and public.aq_norm_email(email) = public.aq_norm_email(new.email);
  return new;
end; $$;

drop trigger if exists aq_claim_comp_trg on auth.users;
create trigger aq_claim_comp_trg after insert on auth.users
  for each row execute function public.aq_claim_comp_subscription();
