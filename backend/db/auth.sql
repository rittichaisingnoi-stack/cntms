-- CNTMS auth — ตาราง users + sessions
create table if not exists users (
  id            bigint generated always as identity primary key,
  username      text not null unique,
  password_hash text not null,             -- bcrypt
  display_name  text,
  role          text default 'staff',      -- staff | admin
  is_active     boolean default true,
  created_at    timestamptz default now()
);

create table if not exists sessions (
  token       text primary key,            -- random 32-byte hex
  user_id     bigint not null references users(id) on delete cascade,
  created_at  timestamptz default now(),
  expires_at  timestamptz not null
);

create index if not exists idx_sessions_user on sessions(user_id);
