-- Anti-cheat: stats change only through server-decided online matches.
DROP FUNCTION IF EXISTS public.record_game_result(text);
DROP FUNCTION IF EXISTS public.merge_guest_stats(p_wins int, p_losses int, p_draws int);

-- Match codes: cryptographically secure generation (gen_random_bytes, 32-symbol
-- alphabet, no modulo bias since 256 % 32 = 0).
CREATE OR REPLACE FUNCTION public.create_match(p_symbol text DEFAULT 'X')
 RETURNS matches
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid(); v_code text; m public.matches;
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; i int; tries int := 0;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in with Google to play online'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = uid) THEN RAISE EXCEPTION 'Profile required'; END IF;
  IF p_symbol NOT IN ('X','O') THEN RAISE EXCEPTION 'Invalid symbol'; END IF;
  UPDATE public.matches mt SET status = 'abandoned', updated_at = now()
  WHERE mt.host_id = uid AND mt.status = 'waiting';
  LOOP
    tries := tries + 1;
    IF tries > 50 THEN RAISE EXCEPTION 'Could not allocate a match code, try again'; END IF;
    v_code := '';
    FOR i IN 1..6 LOOP
      v_code := v_code || substr(alphabet, (get_byte(gen_random_bytes(1), 0) % length(alphabet)) + 1, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.matches mt WHERE mt.code = v_code);
  END LOOP;
  INSERT INTO public.matches (code, host_id, host_symbol, turn, status, expires_at)
  VALUES (v_code, uid, p_symbol, 'X', 'waiting', now() + interval '2 hours')
  RETURNING * INTO m;
  RETURN m;
END; $function$;

-- Accept both legacy 5-character codes and the current 6-character codes.
CREATE OR REPLACE FUNCTION public.join_match(p_code text)
 RETURNS matches
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid(); m public.matches; norm text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in with Google to play online'; END IF;
  norm := upper(btrim(coalesce(p_code, '')));
  IF norm !~ '^[A-Z0-9]{5,6}$' THEN RAISE EXCEPTION 'Match codes are 5-6 characters'; END IF;

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
END; $function$;

-- Profiles: replace the read-everything policy with real predicates —
-- a player sees their own row, and match participants see each other.
DROP POLICY IF EXISTS "profiles readable by authenticated" ON public.profiles;
CREATE POLICY "own profile select"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);
CREATE POLICY "match participants can see each other"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE (m.host_id = auth.uid() AND m.guest_id = profiles.id)
         OR (m.guest_id = auth.uid() AND m.host_id = profiles.id)
    )
  );

-- Coin configuration is server-only: values are served through
-- SECURITY DEFINER functions (wallet_json / coin_cfg), never read directly.
DROP POLICY IF EXISTS "coin config readable" ON public.coin_config;
REVOKE SELECT ON public.coin_config FROM anon, authenticated;
