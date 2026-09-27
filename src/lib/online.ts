import { supabase } from "@/integrations/supabase/client";
import { effectiveAvatar } from "@/lib/avatars";

export interface MatchRow {
  id: string;
  code: string;
  host_id: string;
  guest_id: string | null;
  host_symbol: "X" | "O";
  board: string;
  turn: "X" | "O";
  status: "waiting" | "active" | "finished" | "abandoned";
  result: string | null;
  winner_id: string | null;
  winning_line: number[] | null;
  turn_deadline: string | null;
  host_autopilot: boolean;
  guest_autopilot: boolean;
  host_rematch: boolean;
  guest_rematch: boolean;
  host_seen: string | null;
  guest_seen: string | null;
  round: number;
  expires_at: string;
}

export interface PublicProfile {
  id: string;
  player_id: string;
  nickname: string;
  avatar: string;
  wins: number;
  losses: number;
  draws: number;
}

export async function fetchMatch(code: string): Promise<MatchRow | null> {
  const { data } = await supabase
    .from("matches")
    .select("*")
    .eq("code", code.toUpperCase())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as MatchRow | null) ?? null;
}

export async function fetchProfiles(ids: string[]): Promise<Record<string, PublicProfile>> {
  const unique = ids.filter(Boolean);
  if (unique.length === 0) return {};
  const { data } = await supabase
    .from("profiles")
    .select("id, player_id, nickname, avatar, avatar_type, avatar_url, wins, losses, draws")
    .in("id", unique);
  const out: Record<string, PublicProfile> = {};
  data?.forEach((p) => {
    out[p.id] = {
      id: p.id,
      player_id: p.player_id,
      nickname: p.nickname,
      avatar: effectiveAvatar(p),
      wins: p.wins,
      losses: p.losses,
      draws: p.draws,
    };
  });
  return out;
}

export function mySymbol(match: MatchRow, userId: string): "X" | "O" {
  if (match.host_id === userId) return match.host_symbol;
  return match.host_symbol === "X" ? "O" : "X";
}

export function iAmHost(match: MatchRow, userId: string): boolean {
  return match.host_id === userId;
}

export function myAutopilot(match: MatchRow, userId: string): boolean {
  return iAmHost(match, userId) ? match.host_autopilot : match.guest_autopilot;
}

export function opponentAutopilot(match: MatchRow, userId: string): boolean {
  return iAmHost(match, userId) ? match.guest_autopilot : match.host_autopilot;
}

export function opponentId(match: MatchRow, userId: string): string | null {
  return iAmHost(match, userId) ? match.guest_id : match.host_id;
}

export function opponentSeen(match: MatchRow, userId: string): string | null {
  return iAmHost(match, userId) ? match.guest_seen : match.host_seen;
}

export function iRequestedRematch(match: MatchRow, userId: string): boolean {
  return iAmHost(match, userId) ? match.host_rematch : match.guest_rematch;
}

export function opponentRequestedRematch(match: MatchRow, userId: string): boolean {
  return iAmHost(match, userId) ? match.guest_rematch : match.host_rematch;
}

export function secondsLeft(deadline: string | null): number {
  if (!deadline) return 0;
  return Math.max(0, Math.ceil((new Date(deadline).getTime() - Date.now()) / 1000));
}
