export const AVATARS = [
  { id: "fox", emoji: "🦊" },
  { id: "cat", emoji: "🐱" },
  { id: "panda", emoji: "🐼" },
  { id: "robot", emoji: "🤖" },
  { id: "alien", emoji: "👽" },
  { id: "dragon", emoji: "🐲" },
  { id: "ghost", emoji: "👻" },
  { id: "owl", emoji: "🦉" },
  { id: "shark", emoji: "🦈" },
  { id: "tiger", emoji: "🐯" },
  { id: "unicorn", emoji: "🦄" },
  { id: "penguin", emoji: "🐧" },
] as const;

/** Shop avatars (ids match shop_items). Owning one is enforced by the server. */
export const PREMIUM_AVATARS = [
  { id: "avatar_lion", emoji: "🦁" },
  { id: "avatar_wizard", emoji: "🧙" },
  { id: "avatar_octopus", emoji: "🐙" },
  { id: "avatar_crown", emoji: "👑" },
] as const;

export type AvatarId = (typeof AVATARS)[number]["id"];

export function avatarEmoji(id: string | null | undefined): string {
  return AVATARS.find((a) => a.id === id)?.emoji ?? PREMIUM_AVATARS.find((a) => a.id === id)?.emoji ?? "🎮";
}

/** Google profile pictures are passed around as https URLs in the same `avatar` slot. */
export function isAvatarUrl(value: string | null | undefined): value is string {
  return typeof value === "string" && value.startsWith("https://");
}

/** Effective avatar shown to everyone: Google picture when chosen and available, else app avatar. */
export function effectiveAvatar(p: { avatar: string; avatar_type?: string | null; avatar_url?: string | null }): string {
  return p.avatar_type === "google" && p.avatar_url ? p.avatar_url : p.avatar;
}
