-- ===== Player card =====
CREATE OR REPLACE FUNCTION public.get_player_card(p_user uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uid uuid := auth.uid(); p public.profiles; fr public.friendships; rk bigint; frame text;
  mw int := 0; tw int := 0; dr int := 0; blocked boolean;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO p FROM public.profiles pr WHERE pr.id = p_user;
  IF p.id IS NULL THEN RAISE EXCEPTION 'Player not found'; END IF;
  SELECT * INTO fr FROM public.friendships f
   WHERE (f.requester_id = uid AND f.addressee_id = p_user) OR (f.requester_id = p_user AND f.addressee_id = uid) LIMIT 1;
  SELECT 1 + count(*) INTO rk FROM public.profiles o WHERE o.wins > p.wins;
  SELECT s.preview INTO frame FROM public.user_inventory ui JOIN public.shop_items s ON s.id = ui.item_id
   WHERE ui.user_id = p_user AND ui.equipped AND s.category = 'frame' LIMIT 1;
  blocked := EXISTS (SELECT 1 FROM public.blocked_users b WHERE b.blocker_id = uid AND b.blocked_id = p_user);
  IF p_user <> uid THEN
    SELECT count(*) FILTER (WHERE m.winner_id = uid), count(*) FILTER (WHERE m.winner_id = p_user),
           count(*) FILTER (WHERE m.result = 'draw')
      INTO mw, tw, dr
      FROM public.matches m
     WHERE m.status = 'finished'
       AND ((m.host_id = uid AND m.guest_id = p_user) OR (m.host_id = p_user AND m.guest_id = uid));
  END IF;
  RETURN jsonb_build_object(
    'user_id', p.id, 'player_id', p.player_id, 'nickname', p.nickname,
    'avatar', public.profile_avatar(p.avatar, p.avatar_type, p.avatar_url),
    'frame', frame, 'wins', p.wins, 'losses', p.losses, 'draws', p.draws, 'rank', rk,
    'online', (NOT p.appear_offline AND p.last_seen > now() - interval '90 seconds'),
    'is_me', p.id = uid, 'blocked', blocked,
    'friend_status', CASE WHEN fr.id IS NULL THEN 'none' WHEN fr.status = 'accepted' THEN 'friends'
                          WHEN fr.requester_id = uid THEN 'outgoing' ELSE 'incoming' END,
    'friendship_id', fr.id,
    'h2h', jsonb_build_object('my_wins', mw, 'their_wins', tw, 'draws', dr));
END; $$;
REVOKE ALL ON FUNCTION public.get_player_card(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_player_card(uuid) TO authenticated;

-- ===== Lucky spin =====
ALTER TABLE public.coin_wallets ADD COLUMN IF NOT EXISTS last_spin timestamptz;

CREATE TABLE public.spin_prizes (
  slot int PRIMARY KEY CHECK (slot BETWEEN 0 AND 11),
  amount int NOT NULL CHECK (amount >= 0),
  weight int NOT NULL CHECK (weight >= 0),
  label text NOT NULL
);
GRANT SELECT ON public.spin_prizes TO authenticated;
GRANT ALL ON public.spin_prizes TO service_role;
ALTER TABLE public.spin_prizes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "spin prizes readable" ON public.spin_prizes FOR SELECT TO authenticated USING (true);
INSERT INTO public.spin_prizes (slot, amount, weight, label) VALUES
 (0,10,25,'10'),(1,25,20,'25'),(2,50,10,'50'),(3,100,3,'100'),
 (4,15,22,'15'),(5,35,12,'35'),(6,75,5,'75'),(7,20,18,'20');

CREATE OR REPLACE FUNCTION public.spin_status() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uid uuid := auth.uid(); ls timestamptz;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT w.last_spin INTO ls FROM public.coin_wallets w WHERE w.user_id = uid;
  RETURN jsonb_build_object('next', CASE WHEN ls IS NULL THEN NULL ELSE ls + interval '24 hours' END, 'server_now', now());
END; $$;
REVOKE ALL ON FUNCTION public.spin_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.spin_status() TO authenticated;

CREATE OR REPLACE FUNCTION public.spin_wheel() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uid uuid := auth.uid(); ls timestamptz; total int; r int; acc int := 0; pr record; won public.spin_prizes;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  PERFORM public.coin_ensure_wallet(uid);
  SELECT w.last_spin INTO ls FROM public.coin_wallets w WHERE w.user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile required'; END IF;
  IF ls IS NOT NULL AND ls + interval '24 hours' > now() THEN RAISE EXCEPTION 'Lucky spin already used — come back later'; END IF;
  SELECT sum(sp.weight) INTO total FROM public.spin_prizes sp;
  IF coalesce(total, 0) <= 0 THEN RAISE EXCEPTION 'Lucky spin is not configured'; END IF;
  r := floor(random() * total)::int;
  FOR pr IN SELECT * FROM public.spin_prizes sp ORDER BY sp.slot LOOP
    acc := acc + pr.weight;
    IF r < acc THEN SELECT * INTO won FROM public.spin_prizes sp WHERE sp.slot = pr.slot; EXIT; END IF;
  END LOOP;
  UPDATE public.coin_wallets w SET last_spin = now() WHERE w.user_id = uid;
  PERFORM public.coin_apply(uid, won.amount, 'lucky_spin', 'spin:' || extract(epoch from now())::bigint);
  RETURN jsonb_build_object('slot', won.slot, 'amount', won.amount, 'next', now() + interval '24 hours');
END; $$;
REVOKE ALL ON FUNCTION public.spin_wheel() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.spin_wheel() TO authenticated;

-- ===== In-match chat, emotes, gifts =====
CREATE TABLE public.gift_items (
  id text PRIMARY KEY, emoji text NOT NULL, name text NOT NULL,
  price int NOT NULL CHECK (price >= 0), active boolean NOT NULL DEFAULT true, sort int NOT NULL DEFAULT 0
);
GRANT SELECT ON public.gift_items TO authenticated;
GRANT ALL ON public.gift_items TO service_role;
ALTER TABLE public.gift_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gifts readable" ON public.gift_items FOR SELECT TO authenticated USING (true);
INSERT INTO public.gift_items (id, emoji, name, price, sort) VALUES
 ('chai','☕','Chai',5,1),('rose','🌹','Rose',10,2),('glove','🥊','Boxing Glove',15,3),
 ('tomato','🍅','Tomato',5,4),('trophy','🏆','Trophy',25,5);

CREATE TABLE public.match_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('phrase','emote','gift')),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX match_messages_match_idx ON public.match_messages (match_id, created_at);
GRANT SELECT ON public.match_messages TO authenticated;
GRANT ALL ON public.match_messages TO service_role;
ALTER TABLE public.match_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages visible to players" ON public.match_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_messages.match_id AND (m.host_id = auth.uid() OR m.guest_id = auth.uid())));
ALTER PUBLICATION supabase_realtime ADD TABLE public.match_messages;

CREATE OR REPLACE FUNCTION public.send_match_message(p_code text, p_kind text, p_body text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uid uuid := auth.uid(); m public.matches; opp uuid; g public.gift_items; bal int; msg_id uuid := gen_random_uuid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO m FROM public.matches mm WHERE mm.code = upper(p_code) ORDER BY mm.created_at DESC LIMIT 1;
  IF m.id IS NULL OR (m.host_id <> uid AND m.guest_id IS DISTINCT FROM uid) THEN RAISE EXCEPTION 'Match not found'; END IF;
  IF m.status NOT IN ('active','finished') OR m.guest_id IS NULL THEN RAISE EXCEPTION 'Chat opens once both players are in'; END IF;
  opp := CASE WHEN m.host_id = uid THEN m.guest_id ELSE m.host_id END;
  IF EXISTS (SELECT 1 FROM public.blocked_users b WHERE (b.blocker_id = uid AND b.blocked_id = opp) OR (b.blocker_id = opp AND b.blocked_id = uid)) THEN
    RAISE EXCEPTION 'You can''t message this player';
  END IF;
  IF EXISTS (SELECT 1 FROM public.match_messages x WHERE x.match_id = m.id AND x.sender_id = uid AND x.created_at > now() - interval '1500 milliseconds') THEN
    RAISE EXCEPTION 'Slow down a little';
  END IF;
  IF p_kind = 'phrase' THEN
    IF p_body NOT IN ('Good luck!','Well played!','Nice move!','Oops!','Rematch?','Thinking…','Hurry up!','GG') THEN RAISE EXCEPTION 'Unknown phrase'; END IF;
  ELSIF p_kind = 'emote' THEN
    IF p_body NOT IN ('😂','🔥','😎','😭','👏','🎯','🤔','⏰') THEN RAISE EXCEPTION 'Unknown emote'; END IF;
  ELSIF p_kind = 'gift' THEN
    SELECT * INTO g FROM public.gift_items gi WHERE gi.id = p_body AND gi.active;
    IF g.id IS NULL THEN RAISE EXCEPTION 'Unknown gift'; END IF;
    PERFORM public.coin_ensure_wallet(uid);
    SELECT w.balance INTO bal FROM public.coin_wallets w WHERE w.user_id = uid FOR UPDATE;
    IF coalesce(bal, 0) < g.price THEN RAISE EXCEPTION 'Not enough coins'; END IF;
    PERFORM public.coin_apply(uid, -g.price, 'gift_sent', msg_id::text);
  ELSE
    RAISE EXCEPTION 'Unknown message type';
  END IF;
  INSERT INTO public.match_messages (id, match_id, sender_id, kind, body) VALUES (msg_id, m.id, uid, p_kind, p_body);
  RETURN jsonb_build_object('id', msg_id);
END; $$;
REVOKE ALL ON FUNCTION public.send_match_message(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_match_message(text, text, text) TO authenticated;

-- ===== Shop expansion =====
INSERT INTO public.shop_items (id, name, category, preview, price, sort) VALUES
 ('board_cyber','Cyberpunk Neon','board','cyber',120,4),
 ('board_chalk','Retro Chalkboard','board','chalk',90,5),
 ('board_gold','Luxury Gold','board','gold',200,6),
 ('board_wood','Wooden Vintage','board','wood',100,7),
 ('pieces_ice','Fire & Ice','pieces','🔥|❄️',80,4),
 ('pieces_sword','Laser Swords','pieces','⚔️|🛡️',110,5),
 ('pieces_royal','Royal Crown & Gem','pieces','👑|💎',150,6),
 ('avatar_ninja','Cyber Ninja','avatar','🥷',90,5),
 ('avatar_king','King of TTT','avatar','🤴',140,6),
 ('avatar_gamer','Pixel Gamer','avatar','👾',70,7),
 ('avatar_astro','Space Astronaut','avatar','🧑‍🚀',100,8),
 ('frame_laurel','Golden Laurel','frame','laurel',130,4),
 ('frame_spark','Electric Spark','frame','spark',120,5),
 ('frame_ring','Arcade Neon Ring','frame','ring',100,6),
 ('frame_diamond','Diamond Glow','frame','diamond',180,7)
ON CONFLICT (id) DO NOTHING;