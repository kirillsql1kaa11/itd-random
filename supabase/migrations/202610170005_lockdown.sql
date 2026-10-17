do $$
declare
  r record;
begin
  for r in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'posts', 'authors', 'leaderboard', 'admin_settings',
        'suggestions_posts', 'suggestions_authors', 'game_sessions', 'game_answers'
      )
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

alter table posts enable row level security;
alter table authors enable row level security;
alter table leaderboard enable row level security;
alter table admin_settings enable row level security;
alter table suggestions_posts enable row level security;
alter table suggestions_authors enable row level security;
alter table game_sessions enable row level security;
alter table game_answers enable row level security;

revoke all on table posts from anon, authenticated;
revoke all on table authors from anon, authenticated;
revoke all on table leaderboard from anon, authenticated;
revoke all on table admin_settings from anon, authenticated;
revoke all on table suggestions_posts from anon, authenticated;
revoke all on table suggestions_authors from anon, authenticated;
revoke all on table game_sessions from anon, authenticated;
revoke all on table game_answers from anon, authenticated;
revoke all on table question_stats from anon, authenticated;

grant all on table posts to service_role;
grant all on table authors to service_role;
grant all on table leaderboard to service_role;
grant all on table admin_settings to service_role;
grant all on table suggestions_posts to service_role;
grant all on table suggestions_authors to service_role;
grant all on table game_sessions to service_role;
grant all on table game_answers to service_role;
grant select on table question_stats to service_role;

delete from admin_settings where key like 'rl_login:%';
