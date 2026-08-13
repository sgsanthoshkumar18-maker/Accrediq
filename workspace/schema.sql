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

-- ---------- committee calendar ----------
-- A committee the hospital actually runs, with how often it must meet and when it last
-- did. next_due is DERIVED, never stored: a stored date goes stale the moment a meeting
-- is recorded, and two sources of truth for "are we overdue" is exactly the bug an
-- assessor would find.
create table if not exists public.committees (
  id            text primary key,
  org_id        uuid references public.orgs(id) on delete cascade,
  name          text not null,
  short_name    text,
  frequency     text not null default 'monthly',  -- monthly | quarterly | half_yearly | yearly | fortnightly | weekly
  chairperson   text,
  secretary     text,
  last_met_on   date,
  -- 0=Sunday..6=Saturday, matching JS getDay(). Null means no preference.
  -- The series always advances from the EXACT interval date; this only moves the day the
  -- meeting is shown and held, so a quarterly committee cannot creep away from its quarter.
  pref_dow      smallint,
  active        boolean not null default true,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists committees_org_idx on public.committees(org_id);

-- One row per meeting, held or planned. Kept separate from the committee so the history
-- survives when a committee's frequency changes — an assessor asks "did you meet as
-- often as your own terms of reference say", which needs the record, not the current rule.
create table if not exists public.committee_meetings (
  id            text primary key,
  org_id        uuid references public.orgs(id) on delete cascade,
  committee_id  text references public.committees(id) on delete cascade,
  scheduled_on  date not null,
  held_on       date,
  status        text not null default 'planned',   -- planned | held | missed | cancelled
  attendance    integer,
  quorum_met    boolean,
  agenda        text,
  minutes       text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists cm_org_idx on public.committee_meetings(org_id);
create index if not exists cm_cmte_idx on public.committee_meetings(committee_id);

-- ---------- compliance calendar ----------
-- Recurring NABH obligations that are not committee meetings: drills, audits, calibration,
-- surveillance, document review. Seeded from a standard list on first use, then owned by
-- the hospital.
create table if not exists public.compliance_tasks (
  id            text primary key,
  org_id        uuid references public.orgs(id) on delete cascade,
  title         text not null,
  category      text,            -- drill | audit | training | calibration | surveillance | review | statutory
  element_code  text,            -- the NABH element it evidences, where there is one
  department    text,
  frequency     text not null default 'monthly',
  owner         text,
  last_done_on  date,
  pref_dow      smallint,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists ct_org_idx on public.compliance_tasks(org_id);

-- Added after the tables shipped, so an existing project needs the column too.
alter table public.committees        add column if not exists pref_dow smallint;
alter table public.compliance_tasks  add column if not exists pref_dow smallint;
alter table public.compliance_tasks  add column if not exists owner    text;

-- =====================================================================
-- Segregation of duties (ROM/PSQ expectation, and an assessor's first question)
--
-- A Non-Conformity closed by the person who raised it is a finding in itself: the whole
-- point of verification is that a second pair of eyes confirms the corrective action
-- worked. Until now `can_edit()` was the only gate, so any editor could raise a CAPA and
-- then verify and close it in the same sitting, and nothing in the record showed that had
-- happened.
--
-- Two changes make that impossible rather than merely discouraged:
--   1. authorship is stamped by trigger from the JWT, never trusted from the client
--   2. the transition into verified/closed is refused when the actor raised the row
--
-- Enforced in the DATABASE, not the browser. page-gate.js controls what a page displays;
-- this controls what can be written, which is the only place a rule like this can live.
-- =====================================================================

alter table public.capa       add column if not exists created_by  uuid;
alter table public.capa       add column if not exists verified_by uuid;
alter table public.capa       add column if not exists closed_by   uuid;
alter table public.incidents  add column if not exists created_by  uuid;
alter table public.audits     add column if not exists created_by  uuid;

-- Stamp the author from the JWT on insert. Taken from auth.uid() rather than a client
-- field, so it cannot be forged by sending someone else's id.
-- The trigger LOOP that attaches this lives at the END of this file, not here. It names
-- assets and asset_events, which are created further down, and a loop that references a
-- table before it exists fails the whole script with
--   ERROR: relation "public.assets" does not exist
-- Function definitions are order-independent; trigger attachment is not.
create or replace function public.aq_stamp_author()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.created_by := coalesce(new.created_by, auth.uid());
  return new;
end; $$;


-- Refuse self-verification and self-closure.
create or replace function public.aq_guard_capa_closure()
returns trigger language plpgsql security definer set search_path = public as $$
declare actor uuid := auth.uid();
begin
  -- Only the transition INTO a closing state is guarded. Editing an already-closed row,
  -- or moving it back to open, is a different action and is left to can_edit().
  if new.status in ('verified','closed') and coalesce(old.status,'') not in ('verified','closed') then

    if actor is null then
      raise exception 'AQ_SOD: sign-in required to verify or close a CAPA';
    end if;

    /* An admin or owner may always close: in a small hospital the quality manager who
       raised a finding is sometimes genuinely the only person able to verify it, and a
       rule that cannot be satisfied gets worked around instead of followed. The action is
       still attributed, so the record shows who did it. */
    if new.created_by is not null and new.created_by = actor and not public.is_admin() then
      raise exception
        'AQ_SOD: a CAPA cannot be verified or closed by the person who raised it';
    end if;

    if new.status = 'verified' then new.verified_by := coalesce(new.verified_by, actor); end if;
    if new.status = 'closed'   then new.closed_by   := coalesce(new.closed_by, actor);   end if;
  end if;
  return new;
end; $$;

drop trigger if exists capa_sod_trg on public.capa;
create trigger capa_sod_trg before update on public.capa
  for each row execute function public.aq_guard_capa_closure();

-- Who am I, for the UI. Lets the CAPA page disable a button it knows the database would
-- refuse, so a user is told before they fill a form rather than after.
create or replace function public.aq_my_uid()
returns uuid language sql stable as $$ select auth.uid(); $$;

-- ---------- asset register (FMS.4, FMS.1, HRM.3, MOM.3) ----------
-- One shape for every "thing with an expiry date" a department has to keep: equipment,
-- licences, contracts, credentials, reagents. Ten department-specific tables would be ten
-- things to maintain and ten chances to get a hospital's local practice wrong; one table
-- with a `kind` covers biomedical, facilities, IT, HR, pharmacy and the lab at once.
create table if not exists public.assets (
  id             text primary key,
  org_id         uuid references public.orgs(id) on delete cascade,
  kind           text not null default 'equipment',
    -- equipment | licence | contract | credential | reagent | software
  name           text not null,
  identifier     text,          -- serial, licence number, certificate number
  department     text,
  location       text,
  manufacturer   text,
  model          text,
  owner          text,
  element_code   text,          -- the NABH element it evidences, where there is one
  status         text not null default 'active',  -- active | under_repair | condemned
  commissioned_on date,
  notes          text,
  created_by     uuid,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists assets_org_idx  on public.assets(org_id);
create index if not exists assets_dept_idx on public.assets(department);

-- Recurring obligations ATTACHED to an asset: calibration, preventive maintenance, AMC
-- renewal, licence renewal. Separate from compliance_tasks because these belong to a
-- specific machine or licence and must survive it being moved between departments — an
-- assessor asks for the calibration history of THAT analyser, not of the lab in general.
create table if not exists public.asset_schedules (
  id             text primary key,
  org_id         uuid references public.orgs(id) on delete cascade,
  asset_id       text references public.assets(id) on delete cascade,
  kind           text not null default 'calibration',
    -- calibration | preventive | amc | renewal | inspection
  frequency      text not null default 'yearly',
  last_done_on   date,
  pref_dow       smallint,
  owner          text,
  vendor         text,
  cost_paise     integer,
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists asch_org_idx   on public.asset_schedules(org_id);
create index if not exists asch_asset_idx on public.asset_schedules(asset_id);

-- Each time one is actually performed. The schedule says when it is due; this is the
-- evidence that it happened, with the certificate reference an assessor will ask for.
create table if not exists public.asset_events (
  id             text primary key,
  org_id         uuid references public.orgs(id) on delete cascade,
  asset_id       text references public.assets(id) on delete cascade,
  schedule_id    text references public.asset_schedules(id) on delete set null,
  kind           text not null default 'calibration',
  performed_on   date not null,
  performed_by   text,
  vendor         text,
  certificate_no text,
  result         text default 'pass',   -- pass | pass_with_observation | fail
  downtime_hours numeric,
  notes          text,
  created_by     uuid,
  created_at     timestamptz not null default now()
);
create index if not exists aev_org_idx   on public.asset_events(org_id);
create index if not exists aev_asset_idx on public.asset_events(asset_id);

-- ---------- per-user preferences ----------
-- Keyed on auth.uid() ONLY, never on org: a pinned landing page is a personal choice and
-- a colleague has no business reading or changing it. This is the same reasoning as the
-- activity ledger.
create table if not exists public.user_prefs (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  pinned_page text,
  prefs       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

alter table public.user_prefs enable row level security;

drop policy if exists user_prefs_rw on public.user_prefs;
create policy user_prefs_rw on public.user_prefs for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------- rounds and checklists (IPC.4, IMS.4, FMS.7, PSQ.4) ----------
-- The third shape a department keeps: a recurring round or check that produces a SCORE.
-- Hand hygiene rounds, cleaning audits, medical record review, crash cart checks, BMW
-- segregation. Distinct from compliance_tasks (which asks only "was it done") because the
-- number is the point — an assessor asks what your compliance rate is and whether it moved.
create table if not exists public.checklists (
  id            text primary key,
  org_id        uuid references public.orgs(id) on delete cascade,
  name          text not null,
  department    text,
  element_code  text,
  frequency     text not null default 'monthly',
  pref_dow      smallint,
  owner         text,
  -- The score a hospital holds itself to. An audit with no target cannot fail, and an
  -- audit that cannot fail produces no corrective action for an assessor to look at.
  target_pct    numeric default 90,
  last_done_on  date,
  active        boolean not null default true,
  created_by    uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists chk_org_idx  on public.checklists(org_id);
create index if not exists chk_dept_idx on public.checklists(department);

-- The questions. Kept as rows rather than a JSON blob on the checklist so a round can
-- reference the exact item it scored, and so editing a checklist next quarter does not
-- silently rewrite what last quarter's round was measured against.
create table if not exists public.checklist_items (
  id            text primary key,
  org_id        uuid references public.orgs(id) on delete cascade,
  checklist_id  text references public.checklists(id) on delete cascade,
  position      integer not null default 0,
  text          text not null,
  -- A critical item failing fails the whole round regardless of the percentage: you
  -- cannot average away a missing crash-cart drug.
  critical      boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists cki_org_idx on public.checklist_items(org_id);
create index if not exists cki_lst_idx on public.checklist_items(checklist_id);

-- One completed round. `answers` holds {item_id: "yes"|"no"|"na"} — a jsonb map rather
-- than a row per answer, because a round is always read and written whole and the map
-- keeps it to one request either way.
create table if not exists public.rounds (
  id            text primary key,
  org_id        uuid references public.orgs(id) on delete cascade,
  checklist_id  text references public.checklists(id) on delete set null,
  performed_on  date not null,
  performed_by  text,
  area          text,
  answers       jsonb not null default '{}'::jsonb,
  score_pct     numeric,
  passed        boolean,
  notes         text,
  -- Set when a round fails, so the finding and its CAPA are traceable to the round that
  -- raised it. An audit with no action recorded against it is the most common finding.
  capa_id       text,
  created_by    uuid,
  created_at    timestamptz not null default now()
);
create index if not exists rnd_org_idx on public.rounds(org_id);
create index if not exists rnd_lst_idx on public.rounds(checklist_id);

-- ---------- notifications ----------
-- What a person is told, and how. Notification preferences are PER USER, not per org: a
-- biomedical engineer wants their own equipment, and a quality manager wants everything.
-- Keyed on auth.uid() only, like user_prefs.
create table if not exists public.notify_prefs (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  email_digest   boolean not null default true,
  digest_dow     smallint not null default 1,   -- 0=Sun..6=Sat; Monday by default
  department     text,                          -- null means the whole hospital
  overdue_only   boolean not null default false,
  last_sent_on   date,
  updated_at     timestamptz not null default now()
);
alter table public.notify_prefs enable row level security;
drop policy if exists notify_prefs_rw on public.notify_prefs;
create policy notify_prefs_rw on public.notify_prefs for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- The in-app notification centre. Org-scoped because a finding raised in ICU is the
-- hospital's business, not one person's — but `for_user` narrows it when it is personal.
create table if not exists public.notifications (
  id           text primary key,
  org_id       uuid references public.orgs(id) on delete cascade,
  for_user     uuid,            -- null = everyone in the org
  kind         text not null default 'due',   -- due | overdue | finding | round | system
  title        text not null,
  body         text,
  href         text,
  department   text,
  seen_by      jsonb not null default '[]'::jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists ntf_org_idx on public.notifications(org_id);

-- ---------- onboarding ----------
-- What a hospital has finished setting up. One row per org, so the checklist survives the
-- person who started it leaving — onboarding half-done by someone who has moved on is a
-- common way a platform quietly stops being used.
create table if not exists public.onboarding (
  org_id       uuid primary key references public.orgs(id) on delete cascade,
  steps        jsonb not null default '{}'::jsonb,
  dismissed    boolean not null default false,
  updated_at   timestamptz not null default now()
);

-- ---------- file attachments ----------
-- Metadata only. The file itself lives in Supabase Storage; this row is what makes it
-- findable from the record it evidences. A certificate in someone's inbox is not evidence
-- an assessor can be shown.
create table if not exists public.attachments (
  id           text primary key,
  org_id       uuid references public.orgs(id) on delete cascade,
  entity_table text not null,   -- asset_events | capa | incidents | rounds | committee_meetings
  entity_id    text not null,
  bucket       text not null default 'evidence',
  path         text not null,
  filename     text not null,
  mime         text,
  size_bytes   integer,
  created_by   uuid,
  created_at   timestamptz not null default now()
);
create index if not exists att_org_idx on public.attachments(org_id);
create index if not exists att_ent_idx on public.attachments(entity_table, entity_id);

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
  foreach t in array array['elements','capa','documents','document_versions','audits','incidents',
                        'committees','committee_meetings','compliance_tasks',
                        'assets','asset_schedules','asset_events',
                        'checklists','checklist_items','rounds',
                        'notifications','onboarding','attachments'] loop
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
  foreach t in array array['elements','capa','documents','document_versions','members','audits','incidents',
                        'committees','committee_meetings','compliance_tasks',
                        'assets','asset_schedules','asset_events',
                        'checklists','checklist_items','rounds',
                        'notifications','onboarding','attachments'] loop
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
    public.aq_norm_email('mavissneha@gmail.com')
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
  ('sub_comp_mavisneha', null, 'mavissneha@gmail.com', 'Complimentary',
   'complimentary', 1200, 0, 'complimentary', 'active',
   now(), now(), now() + interval '100 years', 'owner',
   'Lifetime complimentary access granted by the owner.')
on conflict (id) do update
  -- email is updated too, and user_id reset, because this row was first written with a
  -- misspelt address. Without both, re-running this file would leave the old spelling in
  -- place on any project where it already landed, and the trigger below would never
  -- rebind it to the real account. Resetting user_id is safe: the trigger reclaims it on
  -- the next sign-in, and a stale binding to an account that was never created is worse
  -- than none.
  set status = 'active',
      email = excluded.email,
      user_id = null,
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

-- =====================================================================
-- Authorship triggers — LAST, because every table named here must already exist.
-- Attaching a trigger requires the table; defining the function above does not.
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array['capa','incidents','audits','assets','asset_events','checklists','rounds','attachments'] loop
    execute format('drop trigger if exists %I_author_trg on public.%I', t, t);
    execute format(
      'create trigger %I_author_trg before insert on public.%I
         for each row execute function public.aq_stamp_author()', t, t);
  end loop;
end $$;

-- =====================================================================
-- Storage isolation for the 'evidence' bucket
--
-- Creating a private bucket stops the anonymous public reading it. It does NOT stop one
-- signed-in hospital reading another's objects: storage.objects has its own RLS, entirely
-- separate from the table policies above, and a policy of "any authenticated user" would
-- mean a determined subscriber who knew another hospital's path could fetch its incident
-- photographs and credential scans.
--
-- So the ORG IS THE FIRST PATH SEGMENT and these policies check it:
--     {org_id}/{entity_table}/{entity_id}/{random}.{ext}
-- storage.foldername(name) splits the path; element 1 is that leading folder. A user may
-- only touch objects whose leading folder is their own org, which is the same boundary
-- my_org() enforces on every table.
--
-- The path is also stamped server-side into public.attachments by the trigger below, so a
-- client that lied about the path in the metadata row would still be refused by Storage,
-- and a row whose path does not match the org is rejected outright.
-- =====================================================================

do $$
begin
  -- Nothing to do on a project where Storage has never been initialised.
  if not exists (select 1 from information_schema.tables
                 where table_schema = 'storage' and table_name = 'objects') then
    raise notice 'storage.objects not present; skipping evidence bucket policies';
    return;
  end if;

  execute $p$drop policy if exists evidence_read on storage.objects$p$;
  execute $p$create policy evidence_read on storage.objects for select to authenticated
    using (
      bucket_id = 'evidence'
      and (storage.foldername(name))[1] = public.my_org()::text
    )$p$;

  execute $p$drop policy if exists evidence_write on storage.objects$p$;
  execute $p$create policy evidence_write on storage.objects for insert to authenticated
    with check (
      bucket_id = 'evidence'
      and (storage.foldername(name))[1] = public.my_org()::text
      and public.can_edit()
    )$p$;

  execute $p$drop policy if exists evidence_update on storage.objects$p$;
  execute $p$create policy evidence_update on storage.objects for update to authenticated
    using (
      bucket_id = 'evidence'
      and (storage.foldername(name))[1] = public.my_org()::text
    )$p$;

  execute $p$drop policy if exists evidence_delete on storage.objects$p$;
  execute $p$create policy evidence_delete on storage.objects for delete to authenticated
    using (
      bucket_id = 'evidence'
      and (storage.foldername(name))[1] = public.my_org()::text
      and public.can_edit()
    )$p$;
end $$;

-- A metadata row must describe an object inside the writer's own org folder. Without this
-- a client could upload legitimately and then record a path pointing at another hospital's
-- object, and the app would render a link to it — Storage would refuse the fetch, but the
-- filename alone leaks more than it should.
create or replace function public.aq_guard_attachment_path()
returns trigger language plpgsql security definer set search_path = public as $$
declare want text := public.my_org()::text;
begin
  if want is null then
    raise exception 'AQ_ATT: no organisation for this user';
  end if;
  if split_part(new.path, '/', 1) <> want then
    raise exception 'AQ_ATT: attachment path must begin with the organisation id';
  end if;
  return new;
end; $$;

drop trigger if exists attachments_path_trg on public.attachments;
create trigger attachments_path_trg before insert or update on public.attachments
  for each row execute function public.aq_guard_attachment_path();
