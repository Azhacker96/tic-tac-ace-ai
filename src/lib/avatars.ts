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

export type AvatarId = (typeof AVATARS)[number]["id"];

export function avatarEmoji(id: string | null | undefined): string {
  return AVATARS.find((a) => a.id === id)?.emoji ?? "🎮";
}
