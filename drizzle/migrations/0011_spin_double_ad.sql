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
  ELSIF p_kind = 'double_spin' THEN
    SELECT * INTO src FROM public.coin_transactions t
      WHERE t.user_id = uid AND t.type = 'lucky_spin' AND t.created_at > now() - interval '15 minutes'
      ORDER BY t.created_at DESC LIMIT 1;
    IF src.id IS NULL OR src.amount <= 0 THEN RAISE EXCEPTION 'No recent spin to double'; END IF;
    got := public.coin_apply(uid, src.amount, 'ad_double_spin', src.reference);
  ELSE RAISE EXCEPTION 'Unknown ad reward'; END IF;
  IF got IS NULL THEN RAISE EXCEPTION 'This bonus was already claimed'; END IF;
  RETURN public.wallet_json(uid);
END; $$;
REVOKE ALL ON FUNCTION public.claim_ad_reward(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_ad_reward(text, text) TO authenticated;