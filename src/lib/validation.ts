export function validateNickname(value: string): string | null {
  const nick = value.trim();
  if (nick.length === 0) return "Please enter a nickname";
  if (nick.length < 3) return "Nickname must be at least 3 characters";
  if (nick.length > 16) return "Nickname must be 16 characters or fewer";
  if (!/^[\p{L}\p{N} _.-]+$/u.test(nick)) return "Letters, numbers, spaces, . _ - only";
  return null;
}

export function normaliseMatchCode(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 5);
}

export function validateMatchCode(value: string): string | null {
  const code = normaliseMatchCode(value);
  if (code.length !== 5) return "Match codes are 5 characters";
  return null;
}

export function normalisePlayerId(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
}

export function validatePlayerId(value: string): string | null {
  const id = normalisePlayerId(value);
  if (id.length !== 8) return "Player IDs are 8 characters";
  return null;
}

/** Turns a Postgres/PostgREST error into something a player can read. */
export function friendlyError(error: unknown, fallback = "Something went wrong"): string {
  if (!error) return fallback;
  const message =
    typeof error === "string"
      ? error
      : ((error as { message?: string }).message ?? "");
  if (!message) return fallback;
  if (/Failed to fetch|NetworkError|fetch failed/i.test(message)) {
    return "No internet connection. Check your network and try again.";
  }
  if (/JWT|not authenticated/i.test(message)) {
    return "Your session expired. Please sign in again.";
  }
  return message.replace(/^.*?(?:ERROR|error):\s*/, "");
}
