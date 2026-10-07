create or replace function public.lb_rows(p_ids uuid[])
returns table(user_id uuid, player_id text, nickname text, avatar text, wins int, losses int, draws int, rank bigint)
language sql stable security definer set search_path = public as $$
  select p.id, p.player_id, p.nickname, public.profile_avatar(p.avatar, p.avatar_type, p.avatar_url),
         p.wins, p.losses, p.draws,
         rank() over (order by p.wins desc, p.losses asc, p.draws desc)
  from profiles p where p_ids is null or p.id = any(p_ids)
$$;
revoke execute on function public.lb_rows(uuid[]) from public, anon, authenticated;

create or replace function public.get_global_leaderboard(p_limit int default 20)
returns table(user_id uuid, player_id text, nickname text, avatar text, wins int, losses int, draws int, rank bigint, is_me boolean)
language sql stable security definer set search_path = public as $$
  with r as (select * from public.lb_rows(null))
  (select r.*, r.user_id = auth.uid() from r order by r.rank, r.nickname limit least(greatest(p_limit,1),50))
  union
  (select r.*, true from r where r.user_id = auth.uid())
  order by 8, 3
$$;

create or replace function public.get_friends_leaderboard()
returns table(user_id uuid, player_id text, nickname text, avatar text, wins int, losses int, draws int, rank bigint, is_me boolean)
language sql stable security definer set search_path = public as $$
  select r.*, r.user_id = auth.uid() from public.lb_rows(
    array(select auth.uid() union
      select case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end
      from friendships f where f.status = 'accepted' and auth.uid() in (f.requester_id, f.addressee_id))
  ) r order by r.rank, r.nickname
$$;

create or replace function public.get_head_to_head()
returns table(user_id uuid, player_id text, nickname text, avatar text, my_wins int, their_wins int, draws int, played int)
language sql stable security definer set search_path = public as $$
  with fr as (
    select case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end as fid
    from friendships f where f.status = 'accepted' and auth.uid() in (f.requester_id, f.addressee_id)
  )
  select p.id, p.player_id, p.nickname, public.profile_avatar(p.avatar, p.avatar_type, p.avatar_url),
    count(*) filter (where m.winner_id = auth.uid())::int,
    count(*) filter (where m.winner_id = p.id)::int,
    count(*) filter (where m.id is not null and m.winner_id is null)::int,
    count(m.id)::int
  from fr join profiles p on p.id = fr.fid
  left join matches m on m.status = 'finished'
    and ((m.host_id = auth.uid() and m.guest_id = p.id) or (m.guest_id = auth.uid() and m.host_id = p.id))
  group by p.id
  order by 8 desc, 5 desc, p.nickname
$$;

revoke execute on function public.get_global_leaderboard(int), public.get_friends_leaderboard(), public.get_head_to_head() from public, anon;
grant execute on function public.get_global_leaderboard(int), public.get_friends_leaderboard(), public.get_head_to_head() to authenticated;