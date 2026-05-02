create table if not exists players (
  id text primary key,
  name text not null,
  realm_slug text not null,
  realm_name text not null,
  faction text default 'Unknown',
  race text default 'Unknown',
  class_name text default 'Unknown',
  spec text default 'Unknown',
  gender text default 'Unknown',
  last_profile_refresh timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists ladder_entries (
  id bigserial primary key,
  poll_id uuid not null,
  bracket text not null,
  player_id text not null references players(id) on delete cascade,
  rank integer,
  rating integer not null,
  wins integer not null default 0,
  losses integer not null default 0,
  rating_delta integer not null default 0,
  wins_delta integer not null default 0,
  losses_delta integer not null default 0,
  active boolean not null default false,
  detected_at timestamptz not null default now(),
  created_at timestamptz default now()
);

create table if not exists latest_activity (
  player_id text not null references players(id) on delete cascade,
  bracket text not null,
  rank integer,
  rating integer not null,
  wins integer not null default 0,
  losses integer not null default 0,
  rating_delta integer not null default 0,
  wins_delta integer not null default 0,
  losses_delta integer not null default 0,
  last_active_at timestamptz,
  last_seen_at timestamptz not null default now(),
  likely_team text[] default '{}',
  session_record text default '0-0',
  primary key (player_id, bracket)
);

create index if not exists idx_ladder_entries_bracket_detected on ladder_entries(bracket, detected_at desc);
create index if not exists idx_latest_activity_bracket_rating on latest_activity(bracket, rating desc);
create index if not exists idx_latest_activity_last_active on latest_activity(last_active_at desc);
