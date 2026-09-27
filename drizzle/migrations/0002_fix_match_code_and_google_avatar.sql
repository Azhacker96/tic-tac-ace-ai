-- 1. Fix ambiguous "code": local variable renamed, columns qualified, uniqueness checked across all rows (code is UNIQUE).
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
    FOR i IN 1..5 LOOP
      v_code := v_code || substr(alphabet, floor(random() * length(alphabet) + 1)::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.matches mt WHERE mt.code = v_code);
  END LOOP;

  INSERT INTO public.matches (code, host_id, host_symbol, turn, status, expires_at)
  VALUES (v_code, uid, p_symbol, 'X', 'waiting', now() + interval '2 hours')
  RETURNING * INTO m;
  RETURN m;
END; $function$;

-- 2. Google avatar fields
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_type text NOT NULL DEFAULT 'app';
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_avatar_type_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_avatar_type_check CHECK (avatar_type IN ('app','google'));

CREATE OR REPLACE FUNCTION public.profile_avatar(p_avatar text, p_type text, p_url text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $$ SELECT CASE WHEN p_type = 'google' AND p_url IS NOT NULL THEN p_url ELSE p_avatar END $$;

-- Block clients from editing server-owned columns directly.
CREATE OR REPLACE FUNCTION public.guard_profile_update()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$
BEGIN
  IF current_user IN ('authenticated','anon') THEN
    IF NEW.id <> OLD.id OR NEW.player_id <> OLD.player_id OR NEW.wins <> OLD.wins
       OR NEW.losses <> OLD.losses OR NEW.draws <> OLD.draws
       OR NEW.avatar_url IS DISTINCT FROM OLD.avatar_url OR NEW.created_at <> OLD.created_at THEN
      RAISE EXCEPTION 'These profile fields cannot be changed';
    END IF;
  END IF;
  IF NEW.avatar_type = 'google' AND NEW.avatar_url IS NULL THEN
    RAISE EXCEPTION 'No Google profile picture available';
  END IF;
  IF length(btrim(NEW.nickname)) < 3 OR length(btrim(NEW.nickname)) > 16 THEN
    RAISE EXCEPTION 'Nickname must be 3-16 characters';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS guard_profile_update ON public.profiles;
CREATE TRIGGER guard_profile_update BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_update();

-- ensure_profile: one profile per auth user; syncs the Google picture on every sign-in.
CREATE OR REPLACE FUNCTION public.ensure_profile(p_nickname text DEFAULT NULL::text, p_avatar text DEFAULT NULL::text, p_player_id text DEFAULT NULL::text)
 RETURNS profiles LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid(); existing public.profiles; nick text; pid text; pic text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT nullif(coalesce(u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture'), '')
    INTO pic FROM auth.users u WHERE u.id = uid;
  IF pic IS NOT NULL AND pic !~ '^https://' THEN pic := NULL; END IF;

  SELECT * INTO existing FROM public.profiles pr WHERE pr.id = uid;
  IF existing.id IS NOT NULL THEN
    UPDATE public.profiles pr SET last_seen = now(), avatar_url = pic,
      avatar_type = CASE WHEN pic IS NULL THEN 'app' ELSE pr.avatar_type END
    WHERE pr.id = uid RETURNING * INTO existing;
    RETURN existing;
  END IF;

  nick := nullif(btrim(coalesce(p_nickname, '')), '');
  IF nick IS NULL THEN RAISE EXCEPTION 'A nickname is required to create a profile'; END IF;
  IF length(nick) < 3 OR length(nick) > 16 THEN RAISE EXCEPTION 'Nickname must be 3-16 characters'; END IF;

  pid := nullif(upper(btrim(coalesce(p_player_id, ''))), '');
  IF pid IS NULL OR EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.player_id = pid) THEN
    pid := public.generate_player_id();
  END IF;

  INSERT INTO public.profiles (id, player_id, nickname, avatar, avatar_url, avatar_type)
  VALUES (uid, pid, nick, coalesce(nullif(p_avatar, ''), 'fox'), pic, CASE WHEN pic IS NULL THEN 'app' ELSE 'google' END)
  ON CONFLICT (id) DO NOTHING;
  SELECT * INTO existing FROM public.profiles pr WHERE pr.id = uid;

  INSERT INTO public.user_settings (user_id) VALUES (uid) ON CONFLICT DO NOTHING;
  RETURN existing;
END; $function$;

CREATE OR REPLACE FUNCTION public.find_player(p_player_id text)
 RETURNS TABLE(id uuid, player_id text, nickname text, avatar text)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  RETURN QUERY
  SELECT p.id, p.player_id, p.nickname, public.profile_avatar(p.avatar, p.avatar_type, p.avatar_url)
  FROM public.profiles p
  WHERE p.player_id = upper(btrim(coalesce(p_player_id, ''))) AND p.id <> uid
    AND NOT EXISTS (SELECT 1 FROM public.blocked_users b
      WHERE (b.blocker_id = p.id AND b.blocked_id = uid) OR (b.blocker_id = uid AND b.blocked_id = p.id));
END; $function$;

CREATE OR REPLACE FUNCTION public.list_blocked()
 RETURNS TABLE(user_id uuid, player_id text, nickname text, avatar text)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  RETURN QUERY
  SELECT p.id, p.player_id, p.nickname, public.profile_avatar(p.avatar, p.avatar_type, p.avatar_url)
  FROM public.blocked_users b JOIN public.profiles p ON p.id = b.blocked_id
  WHERE b.blocker_id = uid ORDER BY p.nickname;
END; $function$;

CREATE OR REPLACE FUNCTION public.list_friends()
 RETURNS TABLE(friendship_id uuid, user_id uuid, player_id text, nickname text, avatar text, status text, direction text, online boolean, wins integer, losses integer, draws integer)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  RETURN QUERY
  SELECT f.id, p.id, p.player_id, p.nickname,
         public.profile_avatar(p.avatar, p.avatar_type, p.avatar_url),
         f.status::text,
         CASE WHEN f.requester_id = uid THEN 'outgoing' ELSE 'incoming' END,
         (NOT p.appear_offline AND p.last_seen > now() - interval '90 seconds'),
         p.wins, p.losses, p.draws
  FROM public.friendships f
  JOIN public.profiles p ON p.id = CASE WHEN f.requester_id = uid THEN f.addressee_id ELSE f.requester_id END
  WHERE (f.requester_id = uid OR f.addressee_id = uid)
  ORDER BY f.status, p.nickname;
END; $function$;