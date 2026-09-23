-- ============ profiles ============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  player_id text NOT NULL UNIQUE,
  nickname text NOT NULL,
  avatar text NOT NULL DEFAULT 'fox',
  wins int NOT NULL DEFAULT 0,
  losses int NOT NULL DEFAULT 0,
  draws int NOT NULL DEFAULT 0,
  appear_offline boolean NOT NULL DEFAULT false,
  last_seen timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles readable by authenticated" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "own profile insert" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ============ settings ============
CREATE TABLE public.user_settings (
  user_id uuid PRIMARY KEY,
  music boolean NOT NULL DEFAULT true,
  sfx boolean NOT NULL DEFAULT true,
  theme text NOT NULL DEFAULT 'classic',
  dark_mode boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.user_settings TO authenticated;
GRANT ALL ON public.user_settings TO service_role;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own settings" ON public.user_settings
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ blocks ============
CREATE TABLE public.blocked_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL,
  blocked_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_id)
);
GRANT SELECT, INSERT, DELETE ON public.blocked_users TO authenticated;
GRANT ALL ON public.blocked_users TO service_role;
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own blocks" ON public.blocked_users
  FOR ALL TO authenticated USING (auth.uid() = blocker_id) WITH CHECK (auth.uid() = blocker_id);

-- ============ friendships ============
CREATE TYPE public.friend_status AS ENUM ('pending', 'accepted');

CREATE TABLE public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL,
  addressee_id uuid NOT NULL,
  status public.friend_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (requester_id, addressee_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.friendships TO authenticated;
GRANT ALL ON public.friendships TO service_role;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "friendship visible to参与者" ON public.friendships
  FOR SELECT TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);
CREATE POLICY "send friend request" ON public.friendships
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = requester_id
    AND requester_id <> addressee_id
    AND NOT EXISTS (
      SELECT 1 FROM public.blocked_users b
      WHERE (b.blocker_id = addressee_id AND b.blocked_id = requester_id)
         OR (b.blocker_id = requester_id AND b.blocked_id = addressee_id)
    )
  );
CREATE POLICY "respond to friend request" ON public.friendships
  FOR UPDATE TO authenticated USING (auth.uid() = addressee_id) WITH CHECK (auth.uid() = addressee_id);
CREATE POLICY "remove friendship" ON public.friendships
  FOR DELETE TO authenticated USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- ============ matches ============
CREATE TABLE public.matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  host_id uuid NOT NULL,
  guest_id uuid,
  host_symbol text NOT NULL DEFAULT 'X',
  board text NOT NULL DEFAULT '---------',
  turn text NOT NULL DEFAULT 'X',
  status text NOT NULL DEFAULT 'waiting',
  result text,
  winner_id uuid,
  winning_line int[],
  turn_deadline timestamptz,
  host_autopilot boolean NOT NULL DEFAULT false,
  guest_autopilot boolean NOT NULL DEFAULT false,
  host_rematch boolean NOT NULL DEFAULT false,
  guest_rematch boolean NOT NULL DEFAULT false,
  host_seen timestamptz NOT NULL DEFAULT now(),
  guest_seen timestamptz,
  round int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '2 hours',
  CONSTRAINT matches_status_check CHECK (status IN ('waiting','active','finished','abandoned')),
  CONSTRAINT matches_symbol_check CHECK (host_symbol IN ('X','O'))
);
CREATE INDEX matches_code_idx ON public.matches (code);
GRANT SELECT ON public.matches TO authenticated;
GRANT ALL ON public.matches TO service_role;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "match visible to players" ON public.matches
  FOR SELECT TO authenticated USING (auth.uid() = host_id OR auth.uid() = guest_id);

CREATE TABLE public.match_moves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  player_id uuid NOT NULL,
  cell int NOT NULL,
  symbol text NOT NULL,
  autopilot boolean NOT NULL DEFAULT false,
  round int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX match_moves_match_idx ON public.match_moves (match_id);
GRANT SELECT ON public.match_moves TO authenticated;
GRANT ALL ON public.match_moves TO service_role;
ALTER TABLE public.match_moves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "moves visible to players" ON public.match_moves
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id AND (m.host_id = auth.uid() OR m.guest_id = auth.uid())
    )
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.match_moves;
