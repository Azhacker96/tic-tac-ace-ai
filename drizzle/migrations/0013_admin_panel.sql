DO $$ BEGIN CREATE TYPE public.app_role AS ENUM ('admin','moderator','user'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own roles readable" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin')
$$;

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE email = 'm.azeem.talib@gmail.com'
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_settings TO anon, authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "app settings readable" ON public.app_settings FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.app_settings (key, value) VALUES
 ('general', '{"support_email":"","maintenance":false,"maintenance_message":"","min_version":""}'),
 ('admob', '{"enabled":true,"app_id":"","banner_id":"","interstitial_id":"","rewarded_id":""}'),
 ('billing', '{"package_name":"","license_key_note":""}')
ON CONFLICT DO NOTHING;

ALTER TABLE public.iap_products ADD COLUMN IF NOT EXISTS play_product_id text;

CREATE OR REPLACE FUNCTION public.admin_guard() RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admins only'; END IF; END $$;

CREATE OR REPLACE FUNCTION public.admin_analytics() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.admin_guard();
  RETURN jsonb_build_object(
    'players', (SELECT count(*) FROM profiles),
    'new_today', (SELECT count(*) FROM profiles WHERE created_at > now() - interval '1 day'),
    'active_today', (SELECT count(*) FROM profiles WHERE last_seen > now() - interval '1 day'),
    'active_week', (SELECT count(*) FROM profiles WHERE last_seen > now() - interval '7 days'),
    'online_now', (SELECT count(*) FROM profiles WHERE last_seen > now() - interval '2 minutes'),
    'matches_total', (SELECT count(*) FROM matches),
    'matches_today', (SELECT count(*) FROM matches WHERE created_at > now() - interval '1 day'),
    'coins_total', (SELECT coalesce(sum(balance),0) FROM coin_wallets),
    'gems_total', (SELECT coalesce(sum(gems),0) FROM coin_wallets),
    'ad_free_users', (SELECT count(*) FROM coin_wallets WHERE ad_free),
    'ads_today', (SELECT count(*) FROM coin_transactions WHERE type LIKE 'ad_%' AND created_at > now() - interval '1 day'),
    'shop_sales', (SELECT count(*) FROM user_inventory)
  );
END $$;

CREATE OR REPLACE FUNCTION public.admin_list_users(p_search text, p_limit integer DEFAULT 50)
RETURNS TABLE(user_id uuid, email text, player_id text, nickname text, wins integer, losses integer, draws integer, coins integer, gems integer, ad_free boolean, last_seen timestamptz, created_at timestamptz, is_admin boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE q text := '%' || lower(btrim(coalesce(p_search,''))) || '%';
BEGIN
  PERFORM public.admin_guard();
  RETURN QUERY
  SELECT p.id, u.email::text, p.player_id, p.nickname, p.wins, p.losses, p.draws,
         coalesce(w.balance,0), coalesce(w.gems,0), coalesce(w.ad_free,false), p.last_seen, p.created_at,
         public.has_role(p.id,'admin')
  FROM profiles p LEFT JOIN auth.users u ON u.id = p.id LEFT JOIN coin_wallets w ON w.user_id = p.id
  WHERE lower(p.nickname) LIKE q OR lower(p.player_id) LIKE q OR lower(coalesce(u.email,'')) LIKE q
  ORDER BY p.last_seen DESC LIMIT least(greatest(p_limit,1),200);
END $$;

CREATE OR REPLACE FUNCTION public.admin_adjust_wallet(p_user uuid, p_coins integer, p_gems integer, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ref text := 'admin:' || gen_random_uuid()::text || ':' || left(coalesce(p_reason,''),60);
BEGIN
  PERFORM public.admin_guard();
  IF coalesce(p_coins,0) <> 0 THEN PERFORM public.coin_apply(p_user, p_coins, 'admin_adjust', ref); END IF;
  IF coalesce(p_gems,0) <> 0 THEN PERFORM public.gem_apply(p_user, p_gems, 'admin_adjust_gem', ref); END IF;
  RETURN (SELECT jsonb_build_object('coins', balance, 'gems', gems) FROM coin_wallets WHERE user_id = p_user);
END $$;

CREATE OR REPLACE FUNCTION public.admin_reset_cooldowns(p_user uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.admin_guard();
  UPDATE coin_wallets SET last_daily_claim = NULL, last_weekly_claim = NULL, last_spin = NULL WHERE user_id = p_user;
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_ad_free(p_user uuid, p_on boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.admin_guard();
  INSERT INTO coin_wallets (user_id) VALUES (p_user) ON CONFLICT DO NOTHING;
  UPDATE coin_wallets SET ad_free = p_on WHERE user_id = p_user;
END $$;

CREATE OR REPLACE FUNCTION public.admin_economy() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.admin_guard();
  RETURN jsonb_build_object(
    'config', (SELECT coalesce(jsonb_agg(jsonb_build_object('key',key,'value',value,'description',description) ORDER BY key),'[]') FROM coin_config),
    'shop', (SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.category, s.sort),'[]') FROM shop_items s),
    'iap', (SELECT coalesce(jsonb_agg(to_jsonb(i) ORDER BY i.sort),'[]') FROM iap_products i),
    'spin', (SELECT coalesce(jsonb_agg(to_jsonb(sp) ORDER BY sp.slot),'[]') FROM spin_prizes sp)
  );
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_config(p_key text, p_value integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.admin_guard();
  UPDATE coin_config SET value = p_value WHERE key = p_key;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown setting'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.admin_update_shop_item(p_id text, p_price integer, p_gem_price integer, p_active boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.admin_guard();
  IF p_price < 0 OR (p_gem_price IS NOT NULL AND p_gem_price < 0) THEN RAISE EXCEPTION 'Invalid price'; END IF;
  UPDATE shop_items SET price = p_price, gem_price = p_gem_price, active = p_active WHERE id = p_id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_update_iap(p_id text, p_name text, p_coins integer, p_gems integer, p_price_label text, p_play_id text, p_badge text, p_active boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.admin_guard();
  UPDATE iap_products SET name = p_name, coins = greatest(p_coins,0), gems = greatest(p_gems,0), price_label = p_price_label,
    play_product_id = nullif(btrim(p_play_id),''), badge = nullif(btrim(p_badge),''), active = p_active WHERE id = p_id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_update_spin(p_slot integer, p_amount integer, p_weight integer, p_label text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.admin_guard();
  UPDATE spin_prizes SET amount = greatest(p_amount,0), weight = greatest(p_weight,0), label = p_label WHERE slot = p_slot;
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_setting(p_key text, p_value jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.admin_guard();
  IF p_key NOT IN ('general','admob','billing') THEN RAISE EXCEPTION 'Unknown setting'; END IF;
  INSERT INTO app_settings (key, value, updated_at) VALUES (p_key, p_value, now())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
END $$;

CREATE OR REPLACE FUNCTION public.admin_broadcast_gift(p_coins integer, p_gems integer, p_title text) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ref text := 'gift:' || gen_random_uuid()::text; n integer := 0; r record;
BEGIN
  PERFORM public.admin_guard();
  IF coalesce(p_coins,0) < 0 OR coalesce(p_gems,0) < 0 THEN RAISE EXCEPTION 'Gifts must be positive'; END IF;
  FOR r IN SELECT id FROM profiles LOOP
    IF coalesce(p_coins,0) > 0 THEN PERFORM public.coin_apply(r.id, p_coins, 'admin_gift', ref); END IF;
    IF coalesce(p_gems,0) > 0 THEN PERFORM public.gem_apply(r.id, p_gems, 'admin_gift_gem', ref); END IF;
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;

REVOKE EXECUTE ON FUNCTION public.admin_guard() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_analytics(), public.admin_list_users(text,integer), public.admin_adjust_wallet(uuid,integer,integer,text),
  public.admin_reset_cooldowns(uuid), public.admin_set_ad_free(uuid,boolean), public.admin_economy(), public.admin_set_config(text,integer),
  public.admin_update_shop_item(text,integer,integer,boolean), public.admin_update_iap(text,text,integer,integer,text,text,text,boolean),
  public.admin_update_spin(integer,integer,integer,text), public.admin_set_setting(text,jsonb), public.admin_broadcast_gift(integer,integer,text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_admin(), public.admin_guard(), public.admin_analytics(), public.admin_list_users(text,integer), public.admin_adjust_wallet(uuid,integer,integer,text),
  public.admin_reset_cooldowns(uuid), public.admin_set_ad_free(uuid,boolean), public.admin_economy(), public.admin_set_config(text,integer),
  public.admin_update_shop_item(text,integer,integer,boolean), public.admin_update_iap(text,text,integer,integer,text,text,text,boolean),
  public.admin_update_spin(integer,integer,integer,text), public.admin_set_setting(text,jsonb), public.admin_broadcast_gift(integer,integer,text) TO authenticated;