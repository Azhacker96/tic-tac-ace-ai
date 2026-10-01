-- ===== Coin configuration (single source of truth for all coin values) =====
CREATE TABLE public.coin_config (
  key text PRIMARY KEY,
  value integer NOT NULL,
  description text
);
GRANT SELECT ON public.coin_config TO authenticated;
GRANT ALL ON public.coin_config TO service_role;
ALTER TABLE public.coin_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coin config readable" ON public.coin_config FOR SELECT TO authenticated USING (true);

-- ===== Wallets =====
CREATE TABLE public.coin_wallets (
  user_id uuid PRIMARY KEY,
  balance integer NOT NULL DEFAULT 0,
  earned integer NOT NULL DEFAULT 0,
  spent integer NOT NULL DEFAULT 0,
  last_daily_claim timestamptz,
  last_weekly_claim timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.coin_wallets TO authenticated;
GRANT ALL ON public.coin_wallets TO service_role;
ALTER TABLE public.coin_wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own wallet" ON public.coin_wallets FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ===== Ledger =====
CREATE TABLE public.coin_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount integer NOT NULL,
  balance_after integer NOT NULL,
  type text NOT NULL,
  reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, type, reference)
);
CREATE INDEX coin_transactions_user_idx ON public.coin_transactions (user_id, created_at DESC);
GRANT SELECT ON public.coin_transactions TO authenticated;
GRANT ALL ON public.coin_transactions TO service_role;
ALTER TABLE public.coin_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own transactions" ON public.coin_transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ===== Shop =====
CREATE TABLE public.shop_items (
  id text PRIMARY KEY,
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('board','pieces','avatar','frame','other')),
  preview text NOT NULL,
  price integer NOT NULL CHECK (price >= 0),
  active boolean NOT NULL DEFAULT true,
  sort integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.shop_items TO authenticated;
GRANT ALL ON public.shop_items TO service_role;
ALTER TABLE public.shop_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shop readable" ON public.shop_items FOR SELECT TO authenticated USING (true);

CREATE TABLE public.user_inventory (
  user_id uuid NOT NULL,
  item_id text NOT NULL REFERENCES public.shop_items(id),
  equipped boolean NOT NULL DEFAULT false,
  purchased_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_id)
);
GRANT SELECT ON public.user_inventory TO authenticated;
GRANT ALL ON public.user_inventory TO service_role;
ALTER TABLE public.user_inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own inventory" ON public.user_inventory FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ===== Match invites =====
CREATE TABLE public.match_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  code text NOT NULL,
  from_id uuid NOT NULL,
  to_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX match_invites_to_idx ON public.match_invites (to_id, created_at DESC);
GRANT SELECT ON public.match_invites TO authenticated;
GRANT ALL ON public.match_invites TO service_role;
ALTER TABLE public.match_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invite participants" ON public.match_invites FOR SELECT TO authenticated
  USING (auth.uid() = from_id OR auth.uid() = to_id);

-- ===== Core coin helpers =====
CREATE OR REPLACE FUNCTION public.coin_cfg(p_key text) RETURNS integer
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v integer;
BEGIN
  SELECT c.value INTO v FROM public.coin_config c WHERE c.key = p_key;
  IF v IS NULL THEN RAISE EXCEPTION 'Coin setting % is not configured', p_key; END IF;
  RETURN v;
END; $$;

CREATE OR REPLACE FUNCTION public.coin_apply(p_user uuid, p_amount integer, p_type text, p_ref text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE bal integer; applied integer;
BEGIN
  IF p_user IS NULL THEN RETURN NULL; END IF;
  INSERT INTO public.coin_wallets (user_id) VALUES (p_user) ON CONFLICT (user_id) DO NOTHING;
  SELECT w.balance INTO bal FROM public.coin_wallets w WHERE w.user_id = p_user FOR UPDATE;
  IF p_ref IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.coin_transactions t
    WHERE t.user_id = p_user AND t.type = p_type AND t.reference = p_ref
  ) THEN RETURN NULL; END IF;
  applied := p_amount;
  IF applied < 0 AND public.coin_cfg('allow_negative_balance') = 0 THEN
    applied := greatest(applied, -greatest(bal, 0));
  END IF;
  UPDATE public.coin_wallets w SET
    balance = w.balance + applied,
    earned = w.earned + greatest(applied, 0),
    spent = w.spent + greatest(-applied, 0),
    updated_at = now()
  WHERE w.user_id = p_user RETURNING w.balance INTO bal;
  INSERT INTO public.coin_transactions (user_id, amount, balance_after, type, reference)
  VALUES (p_user, applied, bal, p_type, p_ref);
  RETURN applied;
END; $$;
REVOKE ALL ON FUNCTION public.coin_apply(uuid, integer, text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.coin_ensure_wallet(p_user uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF p_user IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = p_user) THEN RETURN; END IF;
  PERFORM public.coin_apply(p_user, public.coin_cfg('signup_bonus'), 'signup_bonus', 'signup');
END; $$;
REVOKE ALL ON FUNCTION public.coin_ensure_wallet(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.coin_game_result(p_match uuid, p_round integer, p_winner uuid, p_loser uuid, p_draw boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE ref text := 'match:' || p_match::text || ':' || p_round::text;
BEGIN
  IF p_draw THEN
    PERFORM public.coin_apply(p_winner, 0, 'game_draw', ref);
    PERFORM public.coin_apply(p_loser, 0, 'game_draw', ref);
  ELSE
    PERFORM public.coin_apply(p_winner, public.coin_cfg('win_reward'), 'game_win', ref);
    PERFORM public.coin_apply(p_loser, -public.coin_cfg('loss_penalty'), 'game_loss', ref);
  END IF;
END; $$;
REVOKE ALL ON FUNCTION public.coin_game_result(uuid, integer, uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.wallet_json(p_user uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE w public.coin_wallets;
BEGIN
  SELECT * INTO w FROM public.coin_wallets cw WHERE cw.user_id = p_user;
  RETURN jsonb_build_object(
    'balance', coalesce(w.balance, 0),
    'earned', coalesce(w.earned, 0),
    'spent', coalesce(w.spent, 0),
    'daily_amount', public.coin_cfg('daily_bonus'),
    'weekly_amount', public.coin_cfg('weekly_bonus'),
    'win_reward', public.coin_cfg('win_reward'),
    'loss_penalty', public.coin_cfg('loss_penalty'),
    'daily_next', CASE WHEN w.last_daily_claim IS NULL THEN NULL ELSE w.last_daily_claim + interval '24 hours' END,
    'weekly_next', CASE WHEN w.last_weekly_claim IS NULL THEN NULL ELSE w.last_weekly_claim + interval '7 days' END,
    'server_now', now()
  );
END; $$;
REVOKE ALL ON FUNCTION public.wallet_json(uuid) FROM PUBLIC, anon, authenticated;

-- ===== Client-callable coin RPCs =====
CREATE OR REPLACE FUNCTION public.get_wallet() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = uid) THEN RAISE EXCEPTION 'Profile required'; END IF;
  PERFORM public.coin_ensure_wallet(uid);
  RETURN public.wallet_json(uid);
END; $$;

CREATE OR REPLACE FUNCTION public.claim_bonus(p_kind text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uid uuid := auth.uid(); w public.coin_wallets;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_kind NOT IN ('daily','weekly') THEN RAISE EXCEPTION 'Unknown bonus'; END IF;
  PERFORM public.coin_ensure_wallet(uid);
  SELECT * INTO w FROM public.coin_wallets cw WHERE cw.user_id = uid FOR UPDATE;
  IF w.user_id IS NULL THEN RAISE EXCEPTION 'Profile required'; END IF;
  IF p_kind = 'daily' THEN
    IF w.last_daily_claim IS NOT NULL AND w.last_daily_claim + interval '24 hours' > now() THEN
      RAISE EXCEPTION 'Daily bonus already claimed';
    END IF;
    UPDATE public.coin_wallets SET last_daily_claim = now() WHERE user_id = uid;
    PERFORM public.coin_apply(uid, public.coin_cfg('daily_bonus'), 'daily_bonus', 'daily:' || extract(epoch from now())::bigint);
  ELSE
    IF w.last_weekly_claim IS NOT NULL AND w.last_weekly_claim + interval '7 days' > now() THEN
      RAISE EXCEPTION 'Weekly bonus already claimed';
    END IF;
    UPDATE public.coin_wallets SET last_weekly_claim = now() WHERE user_id = uid;
    PERFORM public.coin_apply(uid, public.coin_cfg('weekly_bonus'), 'weekly_bonus', 'weekly:' || extract(epoch from now())::bigint);
  END IF;
  RETURN public.wallet_json(uid);
END; $$;

CREATE OR REPLACE FUNCTION public.purchase_item(p_item text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uid uuid := auth.uid(); it public.shop_items; bal integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  PERFORM public.coin_ensure_wallet(uid);
  SELECT w.balance INTO bal FROM public.coin_wallets w WHERE w.user_id = uid FOR UPDATE;
  IF bal IS NULL THEN RAISE EXCEPTION 'Profile required'; END IF;
  SELECT * INTO it FROM public.shop_items s WHERE s.id = p_item;
  IF it.id IS NULL OR NOT it.active THEN RAISE EXCEPTION 'That item is not available'; END IF;
  IF EXISTS (SELECT 1 FROM public.user_inventory ui WHERE ui.user_id = uid AND ui.item_id = it.id) THEN
    RAISE EXCEPTION 'You already own this item';
  END IF;
  IF bal < it.price THEN RAISE EXCEPTION 'Not enough coins'; END IF;
  PERFORM public.coin_apply(uid, -it.price, 'shop_purchase', it.id);
  INSERT INTO public.user_inventory (user_id, item_id) VALUES (uid, it.id);
  RETURN public.wallet_json(uid);
END; $$;

CREATE OR REPLACE FUNCTION public.equip_item(p_item text, p_on boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uid uuid := auth.uid(); it public.shop_items;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT s.* INTO it FROM public.shop_items s
    JOIN public.user_inventory ui ON ui.item_id = s.id AND ui.user_id = uid
  WHERE s.id = p_item;
  IF it.id IS NULL THEN RAISE EXCEPTION 'You do not own this item'; END IF;
  IF p_on THEN
    UPDATE public.user_inventory ui SET equipped = false
    FROM public.shop_items s
    WHERE ui.user_id = uid AND s.id = ui.item_id AND s.category = it.category;
  END IF;
  UPDATE public.user_inventory ui SET equipped = p_on WHERE ui.user_id = uid AND ui.item_id = it.id;
  IF it.category = 'avatar' THEN
    IF p_on THEN
      UPDATE public.profiles pr SET avatar = it.id, avatar_type = 'app' WHERE pr.id = uid;
    ELSE
      UPDATE public.profiles pr SET avatar = 'fox' WHERE pr.id = uid AND pr.avatar = it.id;
    END IF;
  END IF;
END; $$;

-- ===== Profile guard: premium avatars must be owned =====
CREATE OR REPLACE FUNCTION public.guard_profile_update()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  IF current_user IN ('authenticated','anon') THEN
    IF NEW.id <> OLD.id OR NEW.player_id <> OLD.player_id OR NEW.wins <> OLD.wins
       OR NEW.losses <> OLD.losses OR NEW.draws <> OLD.draws
       OR NEW.avatar_url IS DISTINCT FROM OLD.avatar_url OR NEW.created_at <> OLD.created_at THEN
      RAISE EXCEPTION 'These profile fields cannot be changed';
    END IF;
  END IF;
  IF NEW.avatar IS DISTINCT FROM OLD.avatar
     AND EXISTS (SELECT 1 FROM public.shop_items s WHERE s.id = NEW.avatar AND s.category = 'avatar')
     AND NOT EXISTS (SELECT 1 FROM public.user_inventory ui WHERE ui.user_id = NEW.id AND ui.item_id = NEW.avatar) THEN
    RAISE EXCEPTION 'Buy this avatar in the Shop first';
  END IF;
  IF NEW.avatar_type = 'google' AND NEW.avatar_url IS NULL THEN
    RAISE EXCEPTION 'No Google profile picture available';
  END IF;
  IF length(btrim(NEW.nickname)) < 3 OR length(btrim(NEW.nickname)) > 16 THEN
    RAISE EXCEPTION 'Nickname must be 3-16 characters';
  END IF;
  RETURN NEW;
END; $function$;

-- ===== Signup bonus on profile creation =====
CREATE OR REPLACE FUNCTION public.ensure_profile(p_nickname text DEFAULT NULL::text, p_avatar text DEFAULT NULL::text, p_player_id text DEFAULT NULL::text)
 RETURNS profiles LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
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
    PERFORM public.coin_ensure_wallet(uid);
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
  PERFORM public.coin_ensure_wallet(uid);
  RETURN existing;
END; $function$;

-- ===== Server-side game coin rewards =====
CREATE OR REPLACE FUNCTION public.ttt_finish(p_match matches, p_eval jsonb)
 RETURNS matches LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
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
    PERFORM public.coin_game_result(m.id, m.round, winner, loser, false);
  ELSE
    UPDATE public.matches SET status='finished', result='draw', winner_id=NULL,
      turn_deadline = NULL, updated_at = now()
    WHERE id = p_match.id RETURNING * INTO m;
    UPDATE public.profiles SET draws = draws + 1 WHERE id IN (p_match.host_id, p_match.guest_id);
    PERFORM public.coin_game_result(m.id, m.round, p_match.host_id, p_match.guest_id, true);
  END IF;
  RETURN m;
END; $function$;

CREATE OR REPLACE FUNCTION public.claim_abandon(p_code text)
 RETURNS matches LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE uid uuid := auth.uid(); m public.matches; opp_seen timestamptz; opp uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO m FROM public.matches mt WHERE mt.code = upper(btrim(p_code)) ORDER BY mt.created_at DESC LIMIT 1 FOR UPDATE;
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
  PERFORM public.coin_game_result(m.id, m.round, uid, opp, false);
  RETURN m;
END; $function$;

CREATE OR REPLACE FUNCTION public.leave_match(p_code text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE uid uuid := auth.uid(); m public.matches; opp uuid;
BEGIN
  SELECT * INTO m FROM public.matches mt WHERE mt.code = upper(btrim(p_code)) ORDER BY mt.created_at DESC LIMIT 1 FOR UPDATE;
  IF m.id IS NULL OR uid IS NULL THEN RETURN; END IF;
  IF uid NOT IN (m.host_id, coalesce(m.guest_id, '00000000-0000-0000-0000-000000000000'::uuid)) THEN RETURN; END IF;
  IF m.status IN ('waiting') THEN
    UPDATE public.matches SET status='abandoned', updated_at=now() WHERE id = m.id;
  ELSIF m.status = 'active' THEN
    opp := CASE WHEN uid = m.host_id THEN m.guest_id ELSE m.host_id END;
    UPDATE public.matches SET status='finished', result='forfeit', winner_id = opp,
      turn_deadline = NULL, updated_at = now()
    WHERE id = m.id;
    UPDATE public.profiles SET losses = losses + 1 WHERE id = uid;
    UPDATE public.profiles SET wins = wins + 1 WHERE id = opp;
    PERFORM public.coin_game_result(m.id, m.round, opp, uid, false);
  END IF;
END; $function$;

-- ===== Friend invites =====
CREATE OR REPLACE FUNCTION public.invite_friend(p_user_id uuid) RETURNS matches
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uid uuid := auth.uid(); m public.matches;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.friendships f WHERE f.status = 'accepted'
      AND ((f.requester_id = uid AND f.addressee_id = p_user_id) OR (f.requester_id = p_user_id AND f.addressee_id = uid))
  ) THEN RAISE EXCEPTION 'You can only invite accepted friends'; END IF;
  IF EXISTS (SELECT 1 FROM public.blocked_users b
    WHERE (b.blocker_id = uid AND b.blocked_id = p_user_id) OR (b.blocker_id = p_user_id AND b.blocked_id = uid))
  THEN RAISE EXCEPTION 'You cannot invite this player'; END IF;
  m := public.create_match('X');
  UPDATE public.match_invites mi SET status = 'cancelled' WHERE mi.from_id = uid AND mi.status = 'pending';
  INSERT INTO public.match_invites (match_id, code, from_id, to_id) VALUES (m.id, m.code, uid, p_user_id);
  RETURN m;
END; $$;

CREATE OR REPLACE FUNCTION public.list_invites()
RETURNS TABLE(invite_id uuid, code text, from_user uuid, nickname text, avatar text, created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  RETURN QUERY
  SELECT mi.id, mi.code, p.id, p.nickname, public.profile_avatar(p.avatar, p.avatar_type, p.avatar_url), mi.created_at
  FROM public.match_invites mi
  JOIN public.matches mt ON mt.id = mi.match_id
  JOIN public.profiles p ON p.id = mi.from_id
  WHERE mi.to_id = uid AND mi.status = 'pending' AND mt.status = 'waiting'
    AND mt.expires_at > now() AND mi.created_at > now() - interval '15 minutes'
  ORDER BY mi.created_at DESC;
END; $$;

CREATE OR REPLACE FUNCTION public.respond_invite(p_invite uuid, p_accept boolean) RETURNS matches
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uid uuid := auth.uid(); inv public.match_invites; m public.matches;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO inv FROM public.match_invites mi WHERE mi.id = p_invite AND mi.to_id = uid FOR UPDATE;
  IF inv.id IS NULL OR inv.status <> 'pending' THEN RAISE EXCEPTION 'That invite is no longer available'; END IF;
  UPDATE public.match_invites mi SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END WHERE mi.id = inv.id;
  IF NOT p_accept THEN RETURN NULL; END IF;
  m := public.join_match(inv.code);
  RETURN m;
END; $$;