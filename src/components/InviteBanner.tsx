import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AvatarGlyph } from "@/components/AvatarGlyph";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-context";
import { friendlyError } from "@/lib/validation";

interface InviteRow {
  invite_id: string;
  code: string;
  nickname: string;
  avatar: string;
}

/** Incoming one-tap match invites from friends (polled). */
export function InviteBanner() {
  const { identity } = useApp();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);
  const userId = identity?.kind === "google" ? identity.userId : null;

  const { data } = useQuery({
    queryKey: ["invites", userId],
    enabled: Boolean(userId),
    refetchInterval: 10_000,
    queryFn: async () => {
      const { data: rows, error } = await supabase.rpc("list_invites");
      if (error) throw error;
      return (rows ?? []) as InviteRow[];
    },
  });

  if (!data || data.length === 0) return null;

  const respond = async (inv: InviteRow, accept: boolean) => {
    setBusy(inv.invite_id);
    const { error } = await supabase.rpc("respond_invite", { p_invite: inv.invite_id, p_accept: accept });
    setBusy(null);
    void qc.invalidateQueries({ queryKey: ["invites"] });
    if (error) {
      toast.error(friendlyError(error, "That invite is no longer available"));
      return;
    }
    if (accept) void navigate({ to: "/online/$code", params: { code: inv.code } });
  };

  return (
    <div className="mb-4 grid gap-2">
      {data.map((inv) => (
        <div key={inv.invite_id} className="flex items-center gap-3 rounded-2xl border border-primary bg-primary/10 p-3">
          <span className="flex size-10 overflow-hidden items-center justify-center rounded-xl bg-background text-xl">
            <AvatarGlyph avatar={inv.avatar} />
          </span>
          <p className="min-w-0 flex-1 truncate text-sm">
            <span className="font-semibold">{inv.nickname}</span> invited you to play
          </p>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => respond(inv, true)}
            className="rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60"
          >
            {busy === inv.invite_id ? <Loader2 className="size-4 animate-spin" /> : "Join"}
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => respond(inv, false)}
            className="rounded-xl border border-border px-3 py-2 text-xs font-semibold"
          >
            Decline
          </button>
        </div>
      ))}
    </div>
  );
}
