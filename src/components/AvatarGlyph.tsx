import { useState } from "react";

import { avatarEmoji, isAvatarUrl } from "@/lib/avatars";

/** Renders an app avatar emoji, or a Google profile picture when `avatar` is an https URL. */
export function AvatarGlyph({ avatar, fallback }: { avatar: string | null | undefined; fallback?: string | undefined }) {
  const [broken, setBroken] = useState(false);
  if (isAvatarUrl(avatar) && !broken) {
    return (
      <img
        src={avatar}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        className="size-full rounded-[inherit] object-cover"
      />
    );
  }
  return <>{isAvatarUrl(avatar) ? avatarEmoji(fallback ?? null) : avatarEmoji(avatar)}</>;
}
