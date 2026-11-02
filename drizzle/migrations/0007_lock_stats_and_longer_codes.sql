REVOKE EXECUTE ON FUNCTION public.record_game_result(text) FROM PUBLIC, anon, authenticated;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS guest_merged boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.merge_guest_stats(p_wins int, p_losses int, p_draws int)
RETURNS public.profiles LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); out_profile public.profiles;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  -- Only once per account, only right after account creation, capped.
  UPDATE public.profiles pr
  SET wins = pr.wins + least(greatest(coalesce(p_wins,0),0), 200),
      losses = pr.losses + least(greatest(coalesce(p_losses,0),0), 200),
      draws = pr.draws + least(greatest(coalesce(p_draws,0),0), 200),
      guest_merged = true
  WHERE pr.id = uid AND pr.guest_merged = false AND pr.created_at > now() - interval '15 minutes'
  RETURNING * INTO out_profile;
  IF out_profile.id IS NULL THEN
    UPDATE public.profiles pr SET guest_merged = true WHERE pr.id = uid RETURNING * INTO out_profile;
  END IF;
  RETURN out_profile;
END; $$;
REVOKE EXECUTE ON FUNCTION public.merge_guest_stats(int,int,int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_guest_stats(int,int,int) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_match(p_symbol text DEFAULT 'X'::text)
 RETURNS matches LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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
      v_code := v_code || substr(alphabet, floor(random() * length(alphabet) + 1)::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.matches mt WHERE mt.code = v_code);
  END LOOP;
  INSERT INTO public.matches (code, host_id, host_symbol, turn, status, expires_at)
  VALUES (v_code, uid, p_symbol, 'X', 'waiting', now() + interval '2 hours')
  RETURNING * INTO m;
  RETURN m;
END; $function$;