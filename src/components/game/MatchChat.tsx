import { useQuery } from "@tanstack/react-query";
import { Gift, MessageCircle, Smile, Volume2, VolumeX } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useRefreshCoins } from "@/lib/coins";
import { sfx } from "@/lib/sound";
import { cn } from "@/lib/utils";
import { friendlyError } from "@/lib/validation";

/* Allowed values are re-checked by the server (send_match_message). */
const PHRASES = ["Good luck!", "Well played!", "Nice move!", "Oops!", "Rematch?", "Thinking…", "Hurry up!", "GG"];
const EMOTES = ["😂", "🔥", "😎", "😭", "👏", "🎯", "🤔", "⏰"];

interface Msg { id: string; sender_id: string; kind: "phrase" | "emote" | "gift"; body: string }
interface GiftItem { id: string; emoji: string; name: string; price: number }

export interface Bubble { text: string; gift: boolean; key: string }

/** Live quick-chat, emotes and gifts. Reports the latest bubble per player via onBubble. */
export function MatchChat({
  code, matchId, userId, onBubble,
}: { code: string; matchId: string; userId: string; onBubble: (senderId: string, b: Bubble | null) => void }) {
  const [panel, setPanel] = useState<null | "chat" | "emote" | "gift">(null);
  const [muted, setMuted] = useState(false);
  const refreshCoins = useRefreshCoins();

  const gifts = useQuery({
    queryKey: ["gifts"],
    staleTime: 300_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("gift_items").select("id, emoji, name, price").eq("active", true).order("sort");
      if (error) throw error;
      return (data ?? []) as GiftItem[];
    },
  });

  useEffect(() => {
    const gList = gifts.data ?? [];
    const show = (m: Msg) => {
      if (muted && m.sender_id !== userId) return;
      const g = m.kind === "gift" ? gList.find((x) => x.id === m.body) : null;
      const b: Bubble = { text: g ? g.emoji : m.body, gift: Boolean(g), key: m.id };
      onBubble(m.sender_id, b);
      if (m.sender_id !== userId) sfx.tap();
      window.setTimeout(() => onBubble(m.sender_id, null), 3000);
    };
    const ch = supabase
      .channel(`chat-${matchId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "match_messages", filter: `match_id=eq.${matchId}` },
        (p) => show(p.new as Msg))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [matchId, userId, muted, gifts.data, onBubble]);

  const send = async (kind: Msg["kind"], body: string) => {
    setPanel(null);
    const { error } = await supabase.rpc("send_match_message", { p_code: code, p_kind: kind, p_body: body });
    if (error) { toast.error(friendlyError(error)); return; }
    if (kind === "gift") { sfx.coin(); void refreshCoins(); }
  };

  return (
    <div className="mt-3">
      <div className="flex gap-2">
        <IconBtn label="Quick chat" active={panel === "chat"} onClick={() => setPanel(panel === "chat" ? null : "chat")}><MessageCircle className="size-5" /></IconBtn>
        <IconBtn label="Emotes" active={panel === "emote"} onClick={() => setPanel(panel === "emote" ? null : "emote")}><Smile className="size-5" /></IconBtn>
        <IconBtn label="Send gift" active={panel === "gift"} onClick={() => setPanel(panel === "gift" ? null : "gift")}><Gift className="size-5" /></IconBtn>
        <IconBtn label={muted ? "Unmute opponent" : "Mute opponent"} active={muted} onClick={() => setMuted((m) => !m)}>
          {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
        </IconBtn>
      </div>
      {panel === "chat" ? (
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {PHRASES.map((p) => <button key={p} type="button" onClick={() => send("phrase", p)} className="h-10 rounded-xl border border-border bg-surface text-xs font-semibold active:scale-95">{p}</button>)}
        </div>
      ) : panel === "emote" ? (
        <div className="mt-2 grid grid-cols-8 gap-1">
          {EMOTES.map((e) => <button key={e} type="button" onClick={() => send("emote", e)} className="h-11 rounded-xl bg-surface text-2xl active:scale-90">{e}</button>)}
        </div>
      ) : panel === "gift" ? (
        <div className="mt-2 grid grid-cols-5 gap-1.5">
          {(gifts.data ?? []).map((g) => (
            <button key={g.id} type="button" onClick={() => send("gift", g.id)} className="flex flex-col items-center rounded-xl border border-border bg-surface py-1.5 active:scale-95">
              <span className="text-2xl">{g.emoji}</span>
              <span className="text-[10px] font-bold">🪙{g.price}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function IconBtn({ children, label, onClick, active }: { children: React.ReactNode; label: string; onClick: () => void; active?: boolean }) {
  return (
    <button type="button" aria-label={label} onClick={onClick}
      className={cn("flex size-12 items-center justify-center rounded-2xl border active:scale-95", active ? "border-primary bg-primary/15" : "border-border bg-surface")}>
      {children}
    </button>
  );
}

export function BubbleView({ b }: { b: Bubble | null | undefined }) {
  if (!b) return null;
  return (
    <span key={b.key} className={cn(
      "pointer-events-none absolute -top-9 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-2xl border border-border bg-background px-2.5 py-1 font-semibold shadow-lg animate-in zoom-in-50",
      b.gift ? "text-3xl" : b.text.length <= 2 ? "text-2xl" : "text-xs",
    )}>{b.text}</span>
  );
}
