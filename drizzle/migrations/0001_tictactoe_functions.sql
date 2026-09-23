ALTER POLICY "friendship visible to参与者" ON public.friendships RENAME TO "friendship visible to participants";

-- ---------- helpers ----------
CREATE OR REPLACE FUNCTION public.ttt_lines()
RETURNS SETOF int[] LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT l FROM (VALUES
    (ARRAY[0,1,2]),(ARRAY[3,4,5]),(ARRAY[6,7,8]),
    (ARRAY[0,3,6]),(ARRAY[1,4,7]),(ARRAY[2,5,8]),
    (ARRAY[0,4,8]),(ARRAY[2,4,6])
  ) v(l);
$$;

CREATE OR REPLACE FUNCTION public.ttt_at(p_board text, p_cell int)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT substr(p_board, p_cell + 1, 1);
$$;

CREATE OR REPLACE FUNCTION public.ttt_evaluate(p_board text)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE l int[]; a text;
BEGIN
  FOR l IN SELECT * FROM public.ttt_lines() LOOP
    a := public.ttt_at(p_board, l[1]);
    IF a <> '-' AND a = public.ttt_at(p_board, l[2]) AND a = public.ttt_at(p_board, l[3]) THEN
      RETURN jsonb_build_object('status','win','winner',a,'line',to_jsonb(l));
    END IF;
  END LOOP;
  IF position('-' in p_board) = 0 THEN
    RETURN jsonb_build_object('status','draw');
  END IF;
  RETURN jsonb_build_object('status','playing');
END; $$;

-- Heuristic autopilot move: win, block, centre, corner, random.
CREATE OR REPLACE FUNCTION public.ttt_ai_move(p_board text, p_symbol text)
RETURNS int LANGUAGE plpgsql VOLATILE SET search_path = public AS $$
DECLARE
  l int[]; mine int; empties int; empty_cell int; opp text;
  free_cells int[] := ARRAY[]::int[]; i int;
BEGIN
  opp := CASE WHEN p_symbol = 'X' THEN 'O' ELSE 'X' END;
  FOR i IN 0..8 LOOP
    IF public.ttt_at(p_board, i) = '-' THEN free_cells := free_cells || i; END IF;
  END LOOP;
  IF array_length(free_cells, 1) IS NULL THEN RETURN -1; END IF;

  FOR l IN SELECT * FROM public.ttt_lines() LOOP
    mine := 0; empties := 0; empty_cell := NULL;
    FOR i IN 1..3 LOOP
      IF public.ttt_at(p_board, l[i]) = p_symbol THEN mine := mine + 1;
      ELSIF public.ttt_at(p_board, l[i]) = '-' THEN empties := empties + 1; empty_cell := l[i];
      END IF;
    END LOOP;
    IF mine = 2 AND empties = 1 THEN RETURN empty_cell; END IF;
  END LOOP;

  FOR l IN SELECT * FROM public.ttt_lines() LOOP
    mine := 0; empties := 0; empty_cell := NULL;
    FOR i IN 1..3 LOOP
      IF public.ttt_at(p_board, l[i]) = opp THEN mine := mine + 1;
      ELSIF public.ttt_at(p_board, l[i]) = '-' THEN empties := empties + 1; empty_cell := l[i];
      END IF;
    END LOOP;
    IF mine = 2 AND empties = 1 THEN RETURN empty_cell; END IF;
  END LOOP;

  IF 4 = ANY(free_cells) THEN RETURN 4; END IF;
  SELECT c INTO empty_cell FROM unnest(free_cells) c WHERE c IN (0,2,6,8) ORDER BY random() LIMIT 1;
  IF empty_cell IS NOT NULL THEN RETURN empty_cell; END IF;
  SELECT c INTO empty_cell FROM unnest(free_cells) c ORDER BY random() LIMIT 1;
  RETURN empty_cell;
END; $$;

-- ---------- profiles ----------
CREATE OR REPLACE FUNCTION public.generate_player_id()
RETURNS text LANGUAGE plpgsql VOLATILE SET search_path = public AS $$
DECLARE candidate text; alphabet text := '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'; i int;
BEGIN
  LOOP
    candidate := '';
    FOR i IN 1..8 LOOP
      candidate := candidate || substr(alphabet, floor(random() * length(alphabet) + 1)::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE player_id = candidate);
  END LOOP;
  RETURN candidate;
END; $$;

CREATE OR REPLACE FUNCTION public.ensure_profile(
  p_nickname text DEFAULT NULL,
  p_avatar text DEFAULT NULL,
  p_player_id text DEFAULT NULL
)
RETURNS public.profiles LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); existing public.profiles; nick text; pid text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO existing FROM public.profiles WHERE id = uid;
  IF existing.id IS NOT NULL THEN
    UPDATE public.profiles SET last_seen = now() WHERE id = uid RETURNING * INTO existing;
    RETURN existing;
  END IF;

  nick := nullif(btrim(coalesce(p_nickname, '')), '');
  IF nick IS NULL THEN RAISE EXCEPTION 'A nickname is required to create a profile'; END IF;
  IF length(nick) < 3 OR length(nick) > 16 THEN RAISE EXCEPTION 'Nickname must be 3-16 characters'; END IF;

  -- A linked guest may carry over its existing Player ID if it is still free.
  pid := nullif(btrim(coalesce(p_player_id, '')), '');
  IF pid IS NULL OR EXISTS (SELECT 1 FROM public.profiles WHERE player_id = pid) THEN
    pid := public.generate_player_id();
  END IF;

  INSERT INTO public.profiles (id, player_id, nickname, avatar)
  VALUES (uid, pid, nick, coalesce(nullif(p_avatar, ''), 'fox'))
  RETURNING * INTO existing;

  INSERT INTO public.user_settings (user_id) VALUES (uid) ON CONFLICT DO NOTHING;
  RETURN existing;
END; $$;

CREATE OR REPLACE FUNCTION public.merge_guest_stats(p_wins int, p_losses int, p_draws int)
RETURNS public.profiles LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); out_profile public.profiles;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE public.profiles
  SET wins = wins + greatest(coalesce(p_wins,0),0),
      losses = losses + greatest(coalesce(p_losses,0),0),
      draws = draws + greatest(coalesce(p_draws,0),0)
  WHERE id = uid RETURNING * INTO out_profile;
  RETURN out_profile;
END; $$;

CREATE OR REPLACE FUNCTION public.record_game_result(p_result text)
RETURNS public.profiles LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); out_profile public.profiles;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_result NOT IN ('win','loss','draw') THEN RAISE EXCEPTION 'Invalid result'; END IF;
  UPDATE public.profiles SET
    wins = wins + CASE WHEN p_result = 'win' THEN 1 ELSE 0 END,
    losses = losses + CASE WHEN p_result = 'loss' THEN 1 ELSE 0 END,
    draws = draws + CASE WHEN p_result = 'draw' THEN 1 ELSE 0 END,
    last_seen = now()
  WHERE id = uid RETURNING * INTO out_profile;
  RETURN out_profile;
END; $$;

CREATE OR REPLACE FUNCTION public.heartbeat()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.profiles SET last_seen = now() WHERE id = auth.uid();
$$;

-- ---------- matches ----------
CREATE OR REPLACE FUNCTION public.ttt_finish(p_match public.matches, p_eval jsonb)
RETURNS public.matches LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.matches; win_sym text; host_sym text; winner uuid; loser uuid;
BEGIN
  host_sym := p_match.host_symbol;
  IF p_eval->>'status' = 'win' THEN
    win_sym := p_eval->>'winner';
    IF win_sym = host_sym THEN winner := p_match.host_id; loser := p_match.guest_id;
    ELSE winner := p_match.guest_id; loser := p_match.host_id; END IF;
    UPDATE public.matches SET status='finished', result='win', winner_id=winner,
      winning_line = (SELECT array_agg((value)::text::int) FROM jsonb_array_elements(p_eval->'line')),
      turn_deadline = NULL, updated_at = now()
    WHERE id = p_match.id RETURNING * INTO m;
    UPDATE public.profiles SET wins = wins + 1 WHERE id = winner;
    UPDATE public.profiles SET losses = losses + 1 WHERE id = loser;
  ELSE
    UPDATE public.matches SET status='finished', result='draw', winner_id=NULL,
      turn_deadline = NULL, updated_at = now()
    WHERE id = p_match.id RETURNING * INTO m;
    UPDATE public.profiles SET draws = draws + 1 WHERE id IN (p_match.host_id, p_match.guest_id);
  END IF;
  RETURN m;
END; $$;

CREATE OR REPLACE FUNCTION public.create_match(p_symbol text DEFAULT 'X')
RETURNS public.matches LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); code text; m public.matches; alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; i int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in with Google to play online'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = uid) THEN RAISE EXCEPTION 'Profile required'; END IF;
  IF p_symbol NOT IN ('X','O') THEN RAISE EXCEPTION 'Invalid symbol'; END IF;

  -- retire this player's stale open lobbies
  UPDATE public.matches SET status='abandoned', updated_at=now()
  WHERE host_id = uid AND status = 'waiting';

  LOOP
    code := '';
    FOR i IN 1..5 LOOP
      code := code || substr(alphabet, floor(random() * length(alphabet) + 1)::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.matches WHERE matches.code = code AND status IN ('waiting','active'));
  END LOOP;

  INSERT INTO public.matches (code, host_id, host_symbol, turn, status, expires_at)
  VALUES (code, uid, p_symbol, 'X', 'waiting', now() + interval '2 hours')
  RETURNING * INTO m;
  RETURN m;
END; $$;

CREATE OR REPLACE FUNCTION public.join_match(p_code text)
RETURNS public.matches LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); m public.matches; norm text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in with Google to play online'; END IF;
  norm := upper(btrim(coalesce(p_code, '')));
  IF norm !~ '^[A-Z0-9]{5}$' THEN RAISE EXCEPTION 'Match codes are 5 characters'; END IF;

  SELECT * INTO m FROM public.matches WHERE code = norm AND status IN ('waiting','active')
  ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF m.id IS NULL THEN RAISE EXCEPTION 'Match not found'; END IF;
  IF m.host_id = uid OR m.guest_id = uid THEN RETURN m; END IF;
  IF m.status <> 'waiting' OR m.guest_id IS NOT NULL THEN RAISE EXCEPTION 'That match is already full'; END IF;
  IF m.expires_at < now() THEN
    UPDATE public.matches SET status='abandoned' WHERE id = m.id;
    RAISE EXCEPTION 'That match has expired';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.blocked_users b
    WHERE (b.blocker_id = m.host_id AND b.blocked_id = uid)
       OR (b.blocker_id = uid AND b.blocked_id = m.host_id)
  ) THEN RAISE EXCEPTION 'You cannot join this match'; END IF;

  UPDATE public.matches SET guest_id = uid, status = 'active', guest_seen = now(),
    turn_deadline = now() + interval '20 seconds', updated_at = now()
  WHERE id = m.id RETURNING * INTO m;
  RETURN m;
END; $$;

CREATE OR REPLACE FUNCTION public.make_move(p_code text, p_cell int)
RETURNS public.matches LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); m public.matches; my_sym text; new_board text; ev jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO m FROM public.matches WHERE code = upper(btrim(p_code)) ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF m.id IS NULL THEN RAISE EXCEPTION 'Match not found'; END IF;
  IF uid NOT IN (m.host_id, coalesce(m.guest_id, '00000000-0000-0000-0000-000000000000'::uuid)) THEN
    RAISE EXCEPTION 'You are not in this match';
  END IF;
  IF m.status <> 'active' THEN RAISE EXCEPTION 'This match is not in play'; END IF;
  IF p_cell IS NULL OR p_cell < 0 OR p_cell > 8 THEN RAISE EXCEPTION 'Invalid move'; END IF;

  my_sym := CASE WHEN uid = m.host_id THEN m.host_symbol
                 WHEN m.host_symbol = 'X' THEN 'O' ELSE 'X' END;
  IF m.turn <> my_sym THEN RAISE EXCEPTION 'It is not your turn'; END IF;
  IF public.ttt_at(m.board, p_cell) <> '-' THEN RAISE EXCEPTION 'That square is taken'; END IF;

  new_board := overlay(m.board placing my_sym from p_cell + 1 for 1);
  INSERT INTO public.match_moves (match_id, player_id, cell, symbol, autopilot, round)
  VALUES (m.id, uid, p_cell, my_sym, false, m.round);

  ev := public.ttt_evaluate(new_board);
  UPDATE public.matches SET
    board = new_board,
    turn = CASE WHEN my_sym = 'X' THEN 'O' ELSE 'X' END,
    turn_deadline = now() + interval '20 seconds',
    host_autopilot = CASE WHEN uid = m.host_id THEN false ELSE host_autopilot END,
    guest_autopilot = CASE WHEN uid = m.guest_id THEN false ELSE guest_autopilot END,
    host_seen = CASE WHEN uid = m.host_id THEN now() ELSE host_seen END,
    guest_seen = CASE WHEN uid = m.guest_id THEN now() ELSE guest_seen END,
    updated_at = now()
  WHERE id = m.id RETURNING * INTO m;

  IF ev->>'status' <> 'playing' THEN
    m := public.ttt_finish(m, ev);
  END IF;
  RETURN m;
END; $$;

-- Timer expiry: switches the idle player to autopilot and plays for them.
CREATE OR REPLACE FUNCTION public.claim_timeout(p_code text)
RETURNS public.matches LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); m public.matches; turn_player uuid; cell int; new_board text; ev jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO m FROM public.matches WHERE code = upper(btrim(p_code)) ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF m.id IS NULL THEN RAISE EXCEPTION 'Match not found'; END IF;
  IF uid NOT IN (m.host_id, coalesce(m.guest_id, '00000000-0000-0000-0000-000000000000'::uuid)) THEN
    RAISE EXCEPTION 'You are not in this match';
  END IF;
  IF m.status <> 'active' OR m.turn_deadline IS NULL OR m.turn_deadline > now() THEN RETURN m; END IF;

  turn_player := CASE WHEN m.turn = m.host_symbol THEN m.host_id ELSE m.guest_id END;
  cell := public.ttt_ai_move(m.board, m.turn);
  IF cell < 0 THEN RETURN m; END IF;
  new_board := overlay(m.board placing m.turn from cell + 1 for 1);

  INSERT INTO public.match_moves (match_id, player_id, cell, symbol, autopilot, round)
  VALUES (m.id, turn_player, cell, m.turn, true, m.round);

  ev := public.ttt_evaluate(new_board);
  UPDATE public.matches SET
    board = new_board,
    turn = CASE WHEN m.turn = 'X' THEN 'O' ELSE 'X' END,
    turn_deadline = now() + interval '20 seconds',
    host_autopilot = CASE WHEN turn_player = m.host_id THEN true ELSE host_autopilot END,
    guest_autopilot = CASE WHEN turn_player = m.guest_id THEN true ELSE guest_autopilot END,
    updated_at = now()
  WHERE id = m.id RETURNING * INTO m;

  IF ev->>'status' <> 'playing' THEN
    m := public.ttt_finish(m, ev);
  END IF;
  RETURN m;
END; $$;

CREATE OR REPLACE FUNCTION public.set_autopilot(p_code text, p_on boolean)
RETURNS public.matches LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); m public.matches;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO m FROM public.matches WHERE code = upper(btrim(p_code)) ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF m.id IS NULL THEN RAISE EXCEPTION 'Match not found'; END IF;
  IF uid = m.host_id THEN
    UPDATE public.matches SET host_autopilot = p_on, host_seen = now(), updated_at = now()
    WHERE id = m.id RETURNING * INTO m;
  ELSIF uid = m.guest_id THEN
    UPDATE public.matches SET guest_autopilot = p_on, guest_seen = now(), updated_at = now()
    WHERE id = m.id RETURNING * INTO m;
  ELSE
    RAISE EXCEPTION 'You are not in this match';
  END IF;
  RETURN m;
END; $$;

CREATE OR REPLACE FUNCTION public.match_heartbeat(p_code text)
RETURNS public.matches LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); m public.matches;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE public.profiles SET last_seen = now() WHERE id = uid;
  SELECT * INTO m FROM public.matches WHERE code = upper(btrim(p_code)) ORDER BY created_at DESC LIMIT 1;
  IF m.id IS NULL THEN RAISE EXCEPTION 'Match not found'; END IF;
  IF uid = m.host_id THEN
    UPDATE public.matches SET host_seen = now() WHERE id = m.id RETURNING * INTO m;
  ELSIF uid = m.guest_id THEN
    UPDATE public.matches SET guest_seen = now() WHERE id = m.id RETURNING * INTO m;
  END IF;
  -- expire idle lobbies
  IF m.status = 'waiting' AND m.expires_at < now() THEN
    UPDATE public.matches SET status='abandoned' WHERE id = m.id RETURNING * INTO m;
  END IF;
  RETURN m;
END; $$;

-- Forfeit only when the opponent has been gone for two minutes.
CREATE OR REPLACE FUNCTION public.claim_abandon(p_code text)
RETURNS public.matches LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); m public.matches; opp_seen timestamptz; opp uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO m FROM public.matches WHERE code = upper(btrim(p_code)) ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF m.id IS NULL OR m.status <> 'active' THEN RETURN m; END IF;
  IF uid = m.host_id THEN opp := m.guest_id; opp_seen := m.guest_seen;
  ELSIF uid = m.guest_id THEN opp := m.host_id; opp_seen := m.host_seen;
  ELSE RAISE EXCEPTION 'You are not in this match'; END IF;

  IF opp_seen IS NULL OR opp_seen > now() - interval '2 minutes' THEN RETURN m; END IF;

  UPDATE public.matches SET status='finished', result='forfeit', winner_id = uid,
    turn_deadline = NULL, updated_at = now()
  WHERE id = m.id RETURNING * INTO m;
  UPDATE public.profiles SET wins = wins + 1 WHERE id = uid;
  UPDATE public.profiles SET losses = losses + 1 WHERE id = opp;
  RETURN m;
END; $$;

CREATE OR REPLACE FUNCTION public.leave_match(p_code text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); m public.matches;
BEGIN
  SELECT * INTO m FROM public.matches WHERE code = upper(btrim(p_code)) ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF m.id IS NULL OR uid IS NULL THEN RETURN; END IF;
  IF uid NOT IN (m.host_id, coalesce(m.guest_id, '00000000-0000-0000-0000-000000000000'::uuid)) THEN RETURN; END IF;
  IF m.status IN ('waiting') THEN
    UPDATE public.matches SET status='abandoned', updated_at=now() WHERE id = m.id;
  ELSIF m.status = 'active' THEN
    UPDATE public.matches SET status='finished', result='forfeit',
      winner_id = CASE WHEN uid = m.host_id THEN m.guest_id ELSE m.host_id END,
      turn_deadline = NULL, updated_at = now()
    WHERE id = m.id;
    UPDATE public.profiles SET losses = losses + 1 WHERE id = uid;
    UPDATE public.profiles SET wins = wins + 1
    WHERE id = CASE WHEN uid = m.host_id THEN m.guest_id ELSE m.host_id END;
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.request_rematch(p_code text)
RETURNS public.matches LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); m public.matches;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO m FROM public.matches WHERE code = upper(btrim(p_code)) ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF m.id IS NULL THEN RAISE EXCEPTION 'Match not found'; END IF;
  IF m.status <> 'finished' THEN RETURN m; END IF;

  IF uid = m.host_id THEN
    UPDATE public.matches SET host_rematch = true, host_seen = now() WHERE id = m.id RETURNING * INTO m;
  ELSIF uid = m.guest_id THEN
    UPDATE public.matches SET guest_rematch = true, guest_seen = now() WHERE id = m.id RETURNING * INTO m;
  ELSE RAISE EXCEPTION 'You are not in this match'; END IF;

  IF m.host_rematch AND m.guest_rematch THEN
    UPDATE public.matches SET
      board = '---------', turn = 'X', status = 'active', result = NULL, winner_id = NULL,
      winning_line = NULL, host_symbol = CASE WHEN m.host_symbol = 'X' THEN 'O' ELSE 'X' END,
      host_rematch = false, guest_rematch = false,
      host_autopilot = false, guest_autopilot = false,
      round = m.round + 1, turn_deadline = now() + interval '20 seconds',
      expires_at = now() + interval '2 hours', updated_at = now()
    WHERE id = m.id RETURNING * INTO m;
  END IF;
  RETURN m;
END; $$;

-- ---------- friends ----------
CREATE OR REPLACE FUNCTION public.find_player(p_player_id text)
RETURNS TABLE (id uuid, player_id text, nickname text, avatar text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  RETURN QUERY
  SELECT p.id, p.player_id, p.nickname, p.avatar
  FROM public.profiles p
  WHERE p.player_id = upper(btrim(coalesce(p_player_id, '')))
    AND p.id <> uid
    AND NOT EXISTS (
      SELECT 1 FROM public.blocked_users b
      WHERE (b.blocker_id = p.id AND b.blocked_id = uid)
         OR (b.blocker_id = uid AND b.blocked_id = p.id)
    );
END; $$;

CREATE OR REPLACE FUNCTION public.list_friends()
RETURNS TABLE (
  friendship_id uuid, user_id uuid, player_id text, nickname text, avatar text,
  status text, direction text, online boolean, wins int, losses int, draws int
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  RETURN QUERY
  SELECT f.id,
         p.id,
         p.player_id,
         p.nickname,
         p.avatar,
         f.status::text,
         CASE WHEN f.requester_id = uid THEN 'outgoing' ELSE 'incoming' END,
         (NOT p.appear_offline AND p.last_seen > now() - interval '90 seconds'),
         p.wins, p.losses, p.draws
  FROM public.friendships f
  JOIN public.profiles p ON p.id = CASE WHEN f.requester_id = uid THEN f.addressee_id ELSE f.requester_id END
  WHERE (f.requester_id = uid OR f.addressee_id = uid)
  ORDER BY f.status, p.nickname;
END; $$;

CREATE OR REPLACE FUNCTION public.list_blocked()
RETURNS TABLE (user_id uuid, player_id text, nickname text, avatar text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  RETURN QUERY
  SELECT p.id, p.player_id, p.nickname, p.avatar
  FROM public.blocked_users b JOIN public.profiles p ON p.id = b.blocked_id
  WHERE b.blocker_id = uid ORDER BY p.nickname;
END; $$;

CREATE OR REPLACE FUNCTION public.block_player(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_user_id = uid THEN RAISE EXCEPTION 'You cannot block yourself'; END IF;
  INSERT INTO public.blocked_users (blocker_id, blocked_id) VALUES (uid, p_user_id)
  ON CONFLICT DO NOTHING;
  DELETE FROM public.friendships
  WHERE (requester_id = uid AND addressee_id = p_user_id)
     OR (requester_id = p_user_id AND addressee_id = uid);
END; $$;

CREATE OR REPLACE FUNCTION public.send_friend_request(p_player_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); target uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT id INTO target FROM public.profiles WHERE player_id = upper(btrim(coalesce(p_player_id,'')));
  IF target IS NULL THEN RAISE EXCEPTION 'No player with that ID'; END IF;
  IF target = uid THEN RAISE EXCEPTION 'That is your own Player ID'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.blocked_users b
    WHERE (b.blocker_id = target AND b.blocked_id = uid) OR (b.blocker_id = uid AND b.blocked_id = target)
  ) THEN RAISE EXCEPTION 'You cannot add this player'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.friendships f
    WHERE (f.requester_id = uid AND f.addressee_id = target)
       OR (f.requester_id = target AND f.addressee_id = uid)
  ) THEN RAISE EXCEPTION 'You already have a request with this player'; END IF;
  INSERT INTO public.friendships (requester_id, addressee_id, status) VALUES (uid, target, 'pending');
END; $$;

GRANT EXECUTE ON FUNCTION
  public.ensure_profile(text, text, text),
  public.merge_guest_stats(int, int, int),
  public.record_game_result(text),
  public.heartbeat(),
  public.create_match(text),
  public.join_match(text),
  public.make_move(text, int),
  public.claim_timeout(text),
  public.set_autopilot(text, boolean),
  public.match_heartbeat(text),
  public.claim_abandon(text),
  public.leave_match(text),
  public.request_rematch(text),
  public.find_player(text),
  public.list_friends(),
  public.list_blocked(),
  public.block_player(uuid),
  public.send_friend_request(text)
TO authenticated;

REVOKE EXECUTE ON FUNCTION public.ttt_finish(public.matches, jsonb) FROM public;
