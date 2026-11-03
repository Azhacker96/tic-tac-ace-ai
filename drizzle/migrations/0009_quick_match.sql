ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS matches_public_waiting_idx ON public.matches (created_at) WHERE is_public AND status = 'waiting';

CREATE OR REPLACE FUNCTION public.quick_match()
 RETURNS matches
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid(); m public.matches; v_code text;
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; i int; tries int := 0;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in with Google to play online'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = uid) THEN RAISE EXCEPTION 'Profile required'; END IF;

  -- Reuse my own open quick-match lobby if I already have one.
  SELECT * INTO m FROM public.matches mt
  WHERE mt.host_id = uid AND mt.is_public AND mt.status = 'waiting' AND mt.expires_at > now()
  ORDER BY mt.created_at DESC LIMIT 1;
  IF m.id IS NOT NULL THEN RETURN m; END IF;

  -- Join the oldest open public lobby from someone not blocked either way.
  SELECT * INTO m FROM public.matches mt
  WHERE mt.is_public AND mt.status = 'waiting' AND mt.guest_id IS NULL
    AND mt.host_id <> uid AND mt.expires_at > now()
    AND mt.host_seen > now() - interval '30 seconds'
    AND NOT EXISTS (SELECT 1 FROM public.blocked_users b
      WHERE (b.blocker_id = mt.host_id AND b.blocked_id = uid)
         OR (b.blocker_id = uid AND b.blocked_id = mt.host_id))
  ORDER BY mt.created_at ASC LIMIT 1
  FOR UPDATE SKIP LOCKED;
  IF m.id IS NOT NULL THEN
    UPDATE public.matches SET guest_id = uid, status = 'active', guest_seen = now(),
      turn_deadline = now() + interval '20 seconds', updated_at = now()
    WHERE id = m.id RETURNING * INTO m;
    RETURN m;
  END IF;

  -- Nobody waiting: open a new public lobby.
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
  INSERT INTO public.matches (code, host_id, host_symbol, turn, status, expires_at, is_public)
  VALUES (v_code, uid, 'X', 'X', 'waiting', now() + interval '10 minutes', true)
  RETURNING * INTO m;
  RETURN m;
END; $function$;

REVOKE EXECUTE ON FUNCTION public.quick_match() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.quick_match() TO authenticated;