import { getSession } from "@norish/shared/lib/auth/client";

const STORAGE_KEY = "norish-web-outbox-user-id";

function readStoredUserId(): string | null {
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredUserId(userId: string | null): void {
  if (typeof window === "undefined") return;

  try {
    if (userId) {
      window.localStorage.setItem(STORAGE_KEY, userId);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Durable outbox storage still provides the authoritative safety boundary.
  }
}

/**
 * Resolve the active user online and fall back to the last confirmed user when
 * the auth endpoint is unreachable. Sign-out and user switches clear/replace
 * the fallback as soon as the auth endpoint responds again.
 */
export async function getWebOutboxCaptureUserId(): Promise<string | null> {
  try {
    const session = await getSession();

    if (session.error) return readStoredUserId();

    const userId = session.data?.user.id ?? null;

    writeStoredUserId(userId);

    return userId;
  } catch {
    return readStoredUserId();
  }
}

/** Replay is authorized only by a currently reachable Better Auth session. */
export async function getWebOutboxReplayUserId(): Promise<string | null> {
  try {
    const session = await getSession();

    if (session.error) return null;

    const userId = session.data?.user.id ?? null;

    writeStoredUserId(userId);

    return userId;
  } catch {
    return null;
  }
}

export function getLastConfirmedWebOutboxUserId(): string | null {
  return readStoredUserId();
}

/** Diagnostics and capture use the last-confirmed label; replay never calls this alias. */
export const getWebOutboxUserId = getWebOutboxCaptureUserId;
