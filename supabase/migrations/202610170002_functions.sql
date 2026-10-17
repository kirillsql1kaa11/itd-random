create or replace function record_answer(
  p_session_id uuid,
  p_qid text,
  p_post_id text,
  p_selected_author_id text,
  p_is_correct boolean,
  p_speed_bonus integer,
  p_hint_used boolean,
  p_elapsed_ms integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session game_sessions;
  v_inserted boolean := false;
  v_streak integer;
  v_multiplier numeric;
  v_points integer := 0;
begin
  select * into v_session from game_sessions where id = p_session_id for update;
  if not found then
    return jsonb_build_object('error', 'session_not_found');
  end if;
  if v_session.status <> 'active' then
    return jsonb_build_object('error', 'session_closed');
  end if;
  if v_session.expires_at < now() then
    return jsonb_build_object('error', 'session_expired');
  end if;

  insert into game_answers (session_id, qid, post_id, selected_author_id, is_correct, points, elapsed_ms, hint_used)
  values (
    p_session_id,
    p_qid,
    p_post_id,
    p_selected_author_id,
    coalesce(p_is_correct, false),
    0,
    greatest(coalesce(p_elapsed_ms, 0), 0),
    coalesce(p_hint_used, false)
  )
  on conflict (session_id, qid) do nothing
  returning true into v_inserted;

  if coalesce(v_inserted, false) then
    if p_is_correct then
      v_streak := v_session.streak + 1;
      v_multiplier := case
        when v_streak >= 8 then 3.0
        when v_streak >= 5 then 2.0
        when v_streak >= 3 then 1.5
        else 1.0
      end;
      v_points := greatest(
        20,
        round(
          (100 + greatest(0, least(50, coalesce(p_speed_bonus, 0))) - case when coalesce(p_hint_used, false) then 30 else 0 end)
          * v_multiplier
        )
      )::integer;
    else
      v_streak := 0;
      v_multiplier := 1.0;
      v_points := 0;
    end if;

    update game_sessions set
      score = score + v_points,
      streak = v_streak,
      max_streak = greatest(max_streak, v_streak),
      correct_count = correct_count + case when p_is_correct then 1 else 0 end,
      total_count = total_count + 1
    where id = p_session_id;

    update game_answers set points = v_points where session_id = p_session_id and qid = p_qid;

    select * into v_session from game_sessions where id = p_session_id;
  end if;

  return jsonb_build_object(
    'already_answered', not coalesce(v_inserted, false),
    'points', v_points,
    'score', v_session.score,
    'streak', v_session.streak,
    'max_streak', v_session.max_streak,
    'correct_count', v_session.correct_count,
    'total_count', v_session.total_count
  );
end;
$$;

create or replace function submit_game(
  p_session_id uuid,
  p_nickname text,
  p_player_id text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session game_sessions;
  v_record leaderboard;
  v_accuracy integer;
  v_nickname text;
begin
  select * into v_session from game_sessions where id = p_session_id for update;
  if not found then
    return jsonb_build_object('error', 'session_not_found');
  end if;

  if v_session.mode = 'test' then
    return jsonb_build_object('error', 'test_session');
  end if;

  if v_session.status = 'submitted' then
    select * into v_record from leaderboard where session_id = p_session_id limit 1;
    return jsonb_build_object('already_submitted', true, 'record', to_jsonb(v_record));
  end if;

  if v_session.total_count < 1 then
    return jsonb_build_object('error', 'no_answers');
  end if;

  v_accuracy := round(100.0 * v_session.correct_count / v_session.total_count);
  v_nickname := nullif(trim(coalesce(p_nickname, '')), '');
  if v_nickname is null then
    v_nickname := 'Аноним';
  end if;
  v_nickname := left(v_nickname, 32);

  update game_sessions
     set status = 'submitted', submitted_at = now()
   where id = p_session_id;

  insert into leaderboard (nickname, score, streak, accuracy, mode, session_id, player_id)
  values (
    v_nickname,
    v_session.score,
    v_session.max_streak,
    v_accuracy,
    v_session.mode,
    p_session_id,
    coalesce(nullif(p_player_id, ''), v_session.player_id)
  )
  on conflict do nothing
  returning * into v_record;

  if v_record is null then
    select * into v_record from leaderboard where session_id = p_session_id limit 1;
  end if;

  return jsonb_build_object('already_submitted', false, 'record', to_jsonb(v_record));
end;
$$;

drop view if exists question_stats;
create view question_stats as
select
  ga.post_id,
  coalesce(au.name, p.correct_author_id) as author_name,
  count(*)::integer as attempts,
  count(*) filter (where ga.is_correct)::integer as correct,
  round(100.0 * count(*) filter (where not ga.is_correct) / greatest(count(*), 1))::integer as error_rate
from game_answers ga
left join posts p on p.id = ga.post_id
left join authors au on au.id = p.correct_author_id
group by ga.post_id, au.name, p.correct_author_id;

alter view question_stats set (security_invoker = true);

revoke all on function record_answer(uuid, text, text, text, boolean, integer, boolean, integer) from public, anon, authenticated;
revoke all on function submit_game(uuid, text, text) from public, anon, authenticated;
grant execute on function record_answer(uuid, text, text, text, boolean, integer, boolean, integer) to service_role;
grant execute on function submit_game(uuid, text, text) to service_role;
