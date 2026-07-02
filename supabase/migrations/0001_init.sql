-- Adoption Chain: candidate graph and thesis cache.
-- The local JSON store in src/lib/store.ts mirrors these shapes one to one;
-- runs/, chain_nodes/, candidates/, reads/, theses/ map to the stage output files.

create table runs (
  id text primary key,              -- run slug
  seed text not null,
  created_at timestamptz not null default now(),
  float_band_mm int4range not null,
  mode text not null check (mode in ('live', 'fixture')),
  rubric jsonb not null             -- weights + definitions frozen per run, so past ranks stay reproducible
);

create table chain_nodes (
  id text not null,
  run_id text not null references runs(id) on delete cascade,
  layer text not null check (layer in ('enabler', 'picks_and_shovels', 'second_order', 'disrupted')),
  name text not null,
  logic text not null,
  search_phrases jsonb not null,
  primary key (run_id, id)
);

create table candidates (
  run_id text not null references runs(id) on delete cascade,
  cik text not null,
  ticker text not null,
  name text not null,
  node_id text not null,
  fts_hits int not null,
  latest_hit jsonb not null,        -- { form, accession, filedAt, docId }
  public_float_mm numeric,
  status text not null check (status in ('in_band', 'filtered_out', 'scored')),
  filter_reason text,
  primary key (run_id, cik)
);

create table reads (
  run_id text not null references runs(id) on delete cascade,
  ticker text not null,
  cik text not null,
  exposure text not null check (exposure in ('direct', 'adjacent', 'peripheral')),
  eight_k_count_12m int not null,
  quotes jsonb not null,            -- exact filing sentences with form, accession, url
  subscores jsonb not null,         -- { optionality, revenueToOpportunity, catalystDensity, managementConviction }
  primary key (run_id, ticker)
);

create table theses (
  run_id text not null references runs(id) on delete cascade,
  ticker text not null,
  score numeric not null,
  markdown text not null,
  created_at timestamptz not null default now(),
  primary key (run_id, ticker)
);

alter table runs enable row level security;
alter table chain_nodes enable row level security;
alter table candidates enable row level security;
alter table reads enable row level security;
alter table theses enable row level security;

-- Single-analyst tool: anonymous read, writes only through the service role used by the pipeline.
create policy "read runs" on runs for select using (true);
create policy "read chain_nodes" on chain_nodes for select using (true);
create policy "read candidates" on candidates for select using (true);
create policy "read reads" on reads for select using (true);
create policy "read theses" on theses for select using (true);
