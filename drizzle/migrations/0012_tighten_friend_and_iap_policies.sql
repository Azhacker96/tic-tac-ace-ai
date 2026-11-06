ALTER POLICY "send friend request" ON public.friendships
WITH CHECK (
  auth.uid() = requester_id
  AND requester_id <> addressee_id
  AND status = 'pending'
  AND NOT EXISTS (
    SELECT 1 FROM public.blocked_users b
    WHERE (b.blocker_id = addressee_id AND b.blocked_id = requester_id)
       OR (b.blocker_id = requester_id AND b.blocked_id = addressee_id)
  )
);

ALTER POLICY "iap catalog readable" ON public.iap_products
USING (active = true);