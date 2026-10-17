alter table leaderboard add column if not exists session_id uuid;
alter table leaderboard add column if not exists player_id text;

create unique index if not exists leaderboard_session_id_uidx on leaderboard (session_id) where session_id is not null;
create index if not exists leaderboard_mode_score_idx on leaderboard (mode, score desc, accuracy desc, created_at asc);

create table if not exists game_sessions (
  id uuid primary key default gen_random_uuid(),
  mode text not null default 'blitz',
  player_id text,
  nickname text,
  score integer not null default 0,
  streak integer not null default 0,
  max_streak integer not null default 0,
  correct_count integer not null default 0,
  total_count integer not null default 0,
  status text not null default 'active',
  started_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '2 hours'),
  submitted_at timestamptz
);

create index if not exists game_sessions_started_idx on game_sessions (started_at desc);
create index if not exists game_sessions_player_idx on game_sessions (player_id, status);

create table if not exists game_answers (
  id bigserial primary key,
  session_id uuid not null references game_sessions(id) on delete cascade,
  qid text not null,
  post_id text,
  selected_author_id text,
  is_correct boolean not null default false,
  points integer not null default 0,
  elapsed_ms integer not null default 0,
  hint_used boolean not null default false,
  created_at timestamptz not null default now(),
  unique (session_id, qid)
);

create index if not exists game_answers_post_idx on game_answers (post_id);
create index if not exists game_answers_created_idx on game_answers (created_at desc);
