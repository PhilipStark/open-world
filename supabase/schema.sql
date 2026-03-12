-- Open World Database Schema

-- Worlds
create table if not exists worlds (
  id text primary key,
  name text not null,
  tick integer not null default 0,
  map_size integer not null default 50,
  map jsonb, -- Tile[][] stored as JSON
  created_at timestamptz default now()
);

-- Agents
create table if not exists agents (
  id text primary key,
  world_id text references worlds(id) on delete cascade,
  name text not null,
  personality text not null,
  position jsonb not null default '{"x":0,"y":0}',
  needs jsonb not null default '{"hunger":0,"safety":0,"social":0,"purpose":0}',
  memory jsonb not null default '[]',
  relationships jsonb not null default '{}',
  inventory jsonb not null default '{}',
  alive boolean not null default true,
  age integer not null default 0,
  created_at timestamptz default now()
);

-- World Events
create table if not exists world_events (
  id text primary key,
  world_id text references worlds(id) on delete cascade,
  tick integer not null,
  type text not null,
  description text not null,
  involved_agents jsonb not null default '[]',
  created_at timestamptz default now()
);

-- Indexes
create index if not exists agents_world_id_idx on agents(world_id);
create index if not exists world_events_world_id_tick_idx on world_events(world_id, tick desc);
create index if not exists agents_alive_idx on agents(world_id, alive);

-- Enable Realtime
alter publication supabase_realtime add table agents;
alter publication supabase_realtime add table world_events;

-- Agent Connections (OpenClaw webhooks)
create table if not exists agent_connections (
  id uuid primary key default gen_random_uuid(),
  agent_id text references agents(id) on delete cascade,
  world_id text references worlds(id) on delete cascade,
  webhook_url text not null,
  webhook_secret text,
  token text not null unique,
  connected_at timestamptz default now(),
  last_ping timestamptz
);

create index if not exists agent_connections_agent_id_idx on agent_connections(agent_id);
create index if not exists agent_connections_token_idx on agent_connections(token);

-- Helper: get world state
create or replace function get_world_state(p_world_id text)
returns jsonb
language sql
as $$
  select jsonb_build_object(
    'world', row_to_json(w),
    'agents', (select jsonb_agg(row_to_json(a)) from agents a where a.world_id = p_world_id),
    'recentEvents', (select jsonb_agg(row_to_json(e)) from (
      select * from world_events where world_id = p_world_id order by tick desc limit 20
    ) e)
  )
  from worlds w
  where w.id = p_world_id;
$$;
