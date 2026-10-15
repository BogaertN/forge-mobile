-- 0003: shared general-knowledge layer (proof-only admission, plan §13). Canonical rows are immutable versions.
create schema if not exists kb;
revoke all on schema kb from public;
grant usage on schema kb to anon, authenticated;

create type kb.status as enum ('approved','superseded','retracted','disputed');

create table kb.receipts (
  id              uuid primary key default gen_random_uuid(),
  seq             bigint generated always as identity unique,
  action          text not null check (action in ('admit','reject','supersede','retract','cascade_retract',
                    'conflict_open','conflict_resolve','corroborate','expire','publish','revoke_snapshot','role_grant')),
  subject         jsonb not null,
  gks_sha256      text,
  verifier_sha256 text,
  gates           jsonb,
  cause_receipt   uuid references kb.receipts(id),
  prev_hash       text,
  hash            text not null default '',
  created_at      timestamptz not null default now()
);
create index receipts_cause_idx on kb.receipts (cause_receipt);

create table kb.contributions (
  id              uuid primary key default gen_random_uuid(),
  contributor_id  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  signer_id       text not null references public.device_keys(signer_id),
  kind            text not null check (kind in ('fact','rule','lexicon','relation','hypothesis','corroboration','retraction','language_example')),
  payload         jsonb not null check (pg_column_size(payload) <= 32768),
  proof           jsonb check (pg_column_size(proof) <= 65536),
  sources         jsonb not null default '[]',
  content_sha256  text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  signature       text not null,
  consent         jsonb not null,
  gks_sha256      text,
  state           text not null default 'quarantined' check (state in
                    ('quarantined','admitting','rejected','admitted','hypothesis','disputed','withdrawn')),
  screen_result   jsonb,
  decision_receipt uuid references kb.receipts(id),
  created_at      timestamptz not null default now(),
  unique (kind, content_sha256)
);
create index contributions_contributor_idx on kb.contributions (contributor_id, created_at);
create index contributions_signer_idx on kb.contributions (signer_id);
create index contributions_receipt_idx on kb.contributions (decision_receipt);
create index contributions_state_idx on kb.contributions (state) where state in ('quarantined','admitting');

create table kb.facts (
  item_id text not null, version int not null check (version >= 1),
  subject text not null, predicate text not null, object jsonb not null,
  scope text not null default 'general',
  basis text not null default 'proof' check (basis in ('proof','corroboration','authority_import','seed')),
  valid_from timestamptz, valid_to timestamptz,
  status kb.status not null default 'approved',
  content_sha256 text not null, contribution_id uuid references kb.contributions(id),
  receipt_id uuid not null references kb.receipts(id),
  created_at timestamptz not null default now(), primary key (item_id, version)
);
create table kb.rules (
  item_id text not null, version int not null check (version >= 1),
  body jsonb not null, support jsonb not null default '[]', counterevidence jsonb not null default '[]',
  falsifiers jsonb not null check (jsonb_typeof(falsifiers) = 'array' and jsonb_array_length(falsifiers) >= 1),
  lineage jsonb not null default '[]', domain text not null,
  tier text not null default 'proven' check (tier in ('proven','provisional')),
  status kb.status not null default 'approved',
  content_sha256 text not null, contribution_id uuid references kb.contributions(id),
  receipt_id uuid not null references kb.receipts(id),
  created_at timestamptz not null default now(), primary key (item_id, version)
);
create table kb.lexicon_concepts (
  item_id text not null, version int not null check (version >= 1),
  surfaces text[] not null, category text not null, senses jsonb not null,
  licence text not null, provenance text not null, status kb.status not null default 'approved',
  content_sha256 text not null, contribution_id uuid references kb.contributions(id),
  receipt_id uuid not null references kb.receipts(id),
  created_at timestamptz not null default now(), primary key (item_id, version)
);
create table kb.relations (
  item_id text not null, version int not null check (version >= 1),
  src text not null, rel text not null, dst text not null, status kb.status not null default 'approved',
  content_sha256 text not null, contribution_id uuid references kb.contributions(id),
  receipt_id uuid not null references kb.receipts(id),
  created_at timestamptz not null default now(), primary key (item_id, version)
);
-- hypotheses: never selected by the snapshot builder; no FK into facts/rules
create table kb.hypotheses (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('empirical_fact','lexicon','relation','induced_rule')),
  body jsonb not null, falsifiers jsonb not null default '[]',
  state text not null default 'testing' check (state in ('testing','refuted','admitted','expired','withdrawn')),
  origin_contribution uuid references kb.contributions(id),
  receipt_id uuid not null references kb.receipts(id),
  created_at timestamptz not null default now()
);
create table kb.corroborations (
  id uuid primary key default gen_random_uuid(),
  hypothesis_id uuid not null references kb.hypotheses(id),
  contribution_id uuid not null references kb.contributions(id),
  signer_id text not null, source_origin text, source_receipt jsonb not null,
  polarity smallint not null check (polarity in (1,-1)),
  receipt_id uuid not null references kb.receipts(id),
  created_at timestamptz not null default now(),
  unique (hypothesis_id, signer_id)
);
create table kb.conflicts (
  id uuid primary key default gen_random_uuid(),
  a jsonb not null, b jsonb not null,
  state text not null check (state in ('open','resolved_a','resolved_b','disputed')),
  open_receipt uuid not null references kb.receipts(id),
  resolve_receipt uuid references kb.receipts(id),
  created_at timestamptz not null default now()
);
create table kb.attributions (
  id uuid primary key default gen_random_uuid(),
  contribution_id uuid not null references kb.contributions(id),
  signer_id text not null,                                   -- pseudonymous; never the auth uid
  weight numeric not null check (weight in (1, 0.5, 0.3333, 0, -1)),  -- Contribution Token counts; never money
  kind text not null check (kind in ('credit','nullification')),
  receipt_id uuid not null references kb.receipts(id),
  created_at timestamptz not null default now()
);
create table kb.snapshots (
  sha256 text primary key check (sha256 ~ '^[0-9a-f]{64}$'),
  parent_sha256 text references kb.snapshots(sha256),
  seq int not null unique, storage_path text not null, sections jsonb not null, counts jsonb not null,
  receipts_head text not null, publisher_kid text not null, signature text not null,
  receipt_id uuid not null references kb.receipts(id),
  published_at timestamptz not null default now()
);
create table kb.snapshot_revocations (
  sha256 text primary key references kb.snapshots(sha256),
  reason text not null, signature text not null,
  receipt_id uuid not null references kb.receipts(id),
  created_at timestamptz not null default now()
);
-- FK indexes
create index facts_contrib_idx on kb.facts (contribution_id);           create index facts_receipt_idx on kb.facts (receipt_id);
create index rules_contrib_idx on kb.rules (contribution_id);           create index rules_receipt_idx on kb.rules (receipt_id);
create index lex_contrib_idx on kb.lexicon_concepts (contribution_id);  create index lex_receipt_idx on kb.lexicon_concepts (receipt_id);
create index rel_contrib_idx on kb.relations (contribution_id);         create index rel_receipt_idx on kb.relations (receipt_id);
create index hyp_origin_idx on kb.hypotheses (origin_contribution);     create index hyp_receipt_idx on kb.hypotheses (receipt_id);
create index corr_contrib_idx on kb.corroborations (contribution_id);   create index corr_receipt_idx on kb.corroborations (receipt_id);
create index conf_open_idx on kb.conflicts (open_receipt);              create index conf_resolve_idx on kb.conflicts (resolve_receipt);
create index attr_contrib_idx on kb.attributions (contribution_id);     create index attr_receipt_idx on kb.attributions (receipt_id);
create index snap_parent_idx on kb.snapshots (parent_sha256);           create index snap_receipt_idx on kb.snapshots (receipt_id);
create index snaprev_receipt_idx on kb.snapshot_revocations (receipt_id);
