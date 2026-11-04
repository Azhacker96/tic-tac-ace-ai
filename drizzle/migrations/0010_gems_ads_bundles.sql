ALTER TABLE public.coin_wallets ADD COLUMN IF NOT EXISTS gems integer NOT NULL DEFAULT 0;
ALTER TABLE public.coin_wallets ADD COLUMN IF NOT EXISTS ad_free boolean NOT NULL DEFAULT false;
ALTER TABLE public.coin_transactions ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'coin';
ALTER TABLE public.shop_items ADD COLUMN IF NOT EXISTS gem_price integer CHECK (gem_price IS NULL OR gem_price >= 0);

INSERT INTO public.coin_config (key, value, description) VALUES
 ('signup_gems', 20, 'Gems granted once as welcome gift'),
 ('ad_daily_cap', 15, 'Max rewarded-ad bonuses per user per 24h'),
 ('interstitial_every', 3, 'Show an interstitial ad after this many finished games')
ON CONFLICT (key) DO NOTHING;
UPDATE public.coin_config SET value = 150 WHERE key = 'signup_bonus';
UPDATE public.coin_config SET value = 30 WHERE key = 'daily_bonus';
UPDATE public.coin_config SET value = 15 WHERE key = 'win_reward';

-- Rebalanced shop prices (coins x3) and gem-only legendary items
UPDATE public.shop_items SET price = price * 3 WHERE price < 250;
UPDATE public.shop_items SET gem_price = 80 WHERE id = 'board_gold';
UPDATE public.shop_items SET gem_price = 60 WHERE id IN ('avatar_king','frame_diamond');
UPDATE public.shop_items SET gem_price = 50 WHERE id = 'pieces_royal';

-- Real-money catalog (granted only after verified Google Play purchase)
CREATE TABLE public.iap_products (
  id text PRIMARY KEY,
  name text NOT NULL,
  coins integer NOT NULL DEFAULT 0,
  gems integer NOT NULL DEFAULT 0,
  ad_free boolean NOT NULL DEFAULT false,
  price_label text NOT NULL,
  badge text,
  active boolean NOT NULL DEFAULT true,
  sort integer NOT NULL DEFAULT 0
);
GRANT SELECT ON public.iap_products TO authenticated;
GRANT ALL ON public.iap_products TO service_role;
ALTER TABLE public.iap_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "iap catalog readable" ON public.iap_products FOR SELECT TO authenticated USING (true);
INSERT INTO public.iap_products (id, name, coins, gems, ad_free, price_label, badge, sort) VALUES
 ('starter_bundle','Starter Bundle',500,50,false,'$0.99','Best value',1),
 ('gems_50','Handful of Gems',0,50,false,'$0.99',NULL,2),
 ('gems_150','Bag of Gems',0,150,false,'$2.49','Popular',3),
 ('gems_400','Chest of Gems',0,400,false,'$4.99',NULL,4),
 ('ad_free','Ad-Free Pass',0,0,true,'$2.99','VIP',5);

CREATE OR REPLACE FUNCTION public.gem_apply(p_user uuid, p_amount integer, p_type text, p_ref text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE bal integer;
BEGIN
  IF p_user IS NULL THEN RETURN NULL; END IF;
  INSERT INTO public.coin_wallets (user_id) VALUES (p_user) ON CONFLICT (user_id) DO NOTHING;
  SELECT w.gems INTO bal FROM public.coin_wallets w WHERE w.user_id = p_user FOR UPDATE;
  IF p_ref IS NOT NULL AND EXISTS (SELECT 1 FROM public.coin_transactions t
     WHERE t.user_id = p_user AND t.type = p_type AND t.reference = p_ref) THEN RETURN NULL; END IF;
  IF bal + p_amount < 0 THEN RAISE EXCEPTION 'Not enough gems'; END IF;
  UPDATE public.coin_wallets w SET gems = w.gems + p_amount, updated_at = now()
    WHERE w.user_id = p_user RETURNING w.gems INTO bal;
  INSERT INTO public.coin_transactions (user_id, amount, balance_after, type, reference, currency)
    VALUES (p_user, p_amount, bal, p_type, p_ref, 'gem');
  RETURN p_amount;
END; $$;
REVOKE ALL ON FUNCTION public.gem_apply(uuid, integer, text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.coin_ensure_wallet(p_user uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF p_user IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = p_user) THEN RETURN; END IF;
  PERFORM public.coin_apply(p_user, public.coin_cfg('signup_bonus'), 'signup_bonus', 'signup');
  PERFORM public.gem_apply(p_user, public.coin_cfg('signup_gems'), 'welcome_gems', 'signup');
END; $$;
REVOKE ALL ON FUNCTION public.coin_ensure_wallet(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.wallet_json(p_user uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE w public.coin_wallets; used int;
BEGIN
  SELECT * INTO w FROM public.coin_wallets cw WHERE cw.user_id = p_user;
  SELECT count(*) INTO used FROM public.coin_transactions t
    WHERE t.user_id = p_user AND t.type LIKE 'ad\_%' AND t.created_at > now() - interval '24 hours';
  RETURN jsonb_build_object(
    'balance', coalesce(w.balance, 0),
    'gems', coalesce(w.gems, 0),
    'ad_free', coalesce(w.ad_free, false),
    'ad_rewards_left', greatest(public.coin_cfg('ad_daily_cap') - used, 0),
    'interstitial_every', public.coin_cfg('interstitial_every'),
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

CREATE OR REPLACE FUNCTION public.purchase_item(p_item text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uid uuid := auth.uid(); it public.shop_items; w public.coin_wallets;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  PERFORM public.coin_ensure_wallet(uid);
  SELECT * INTO w FROM public.coin_wallets cw WHERE cw.user_id = uid FOR UPDATE;
  IF w.user_id IS NULL THEN RAISE EXCEPTION 'Profile required'; END IF;
  SELECT * INTO it FROM public.shop_items s WHERE s.id = p_item;
  IF it.id IS NULL OR NOT it.active THEN RAISE EXCEPTION 'That item is not available'; END IF;
  IF EXISTS (SELECT 1 FROM public.user_inventory ui WHERE ui.user_id = uid AND ui.item_id = it.id) THEN
    RAISE EXCEPTION 'You already own this item';
  END IF;
  IF it.gem_price IS NOT NULL THEN
    IF w.gems < it.gem_price THEN RAISE EXCEPTION 'Not enough gems'; END IF;
    PERFORM public.gem_apply(uid, -it.gem_price, 'gem_purchase', it.id);
  ELSE
    IF w.balance < it.price THEN RAISE EXCEPTION 'Not enough coins'; END IF;
    PERFORM public.coin_apply(uid, -it.price, 'shop_purchase', it.id);
  END IF;
  INSERT INTO public.user_inventory (user_id, item_id) VALUES (uid, it.id);
  RETURN public.wallet_json(uid);
END; $$;

-- Rewarded-ad bonuses: double a win once, or double today's daily bonus once.
CREATE OR REPLACE FUNCTION public.claim_ad_reward(p_kind text, p_ref text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uid uuid := auth.uid(); used int; src public.coin_transactions; got int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  PERFORM 1 FROM public.coin_wallets w WHERE w.user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile required'; END IF;
  SELECT count(*) INTO used FROM public.coin_transactions t
    WHERE t.user_id = uid AND t.type LIKE 'ad\_%' AND t.created_at > now() - interval '24 hours';
  IF used >= public.coin_cfg('ad_daily_cap') THEN RAISE EXCEPTION 'Ad bonus limit reached for today'; END IF;
  IF p_kind = 'double_win' THEN
    SELECT * INTO src FROM public.coin_transactions t
      WHERE t.user_id = uid AND t.type = 'game_win' AND t.reference = p_ref
        AND t.created_at > now() - interval '30 minutes';
    IF src.id IS NULL OR src.amount <= 0 THEN RAISE EXCEPTION 'No recent win to double'; END IF;
    got := public.coin_apply(uid, src.amount, 'ad_double_win', src.reference);
  ELSIF p_kind = 'daily_double' THEN
    SELECT * INTO src FROM public.coin_transactions t
      WHERE t.user_id = uid AND t.type = 'daily_bonus' AND t.created_at > now() - interval '24 hours'
      ORDER BY t.created_at DESC LIMIT 1;
    IF src.id IS NULL THEN RAISE EXCEPTION 'Claim your daily bonus first'; END IF;
    got := public.coin_apply(uid, src.amount, 'ad_daily_double', src.reference);
  ELSE RAISE EXCEPTION 'Unknown ad reward'; END IF;
  IF got IS NULL THEN RAISE EXCEPTION 'This bonus was already claimed'; END IF;
  RETURN public.wallet_json(uid);
END; $$;
REVOKE ALL ON FUNCTION public.claim_ad_reward(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_ad_reward(text, text) TO authenticated;