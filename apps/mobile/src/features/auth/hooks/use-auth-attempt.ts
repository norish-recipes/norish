import { useRef, useState } from "react";
import { authFailure } from "@/features/auth/utils/auth-failure";
import { useIntl } from "react-intl";

import { createClientLogger } from "@norish/shared/lib/logger";

const log = createClientLogger("auth");

const DEFAULT_FAILURE = "auth.errors.default.description";

type AuthCall = () => Promise<{ error: { code?: string; message?: string } | null }>;

/** A failed attempt and the method it came from; each is a new object, so it shakes again. */
export type AuthAttemptFailure = { method: string; message: string } | null;

/**
 * A signed-out form's attempts: one in flight at a time, every method waiting on it, and one
 * translated inline error, cleared as the next attempt starts.
 */
export function useAuthAttempt() {
  const intl = useIntl();
  const [running, setRunning] = useState<string | null>(null);
  const [failure, setFailure] = useState<AuthAttemptFailure>(null);
  // State lands on the next render, so a second tap or return key in the same tick reads this.
  const inFlightRef = useRef(false);

  /** Runs `task`, which resolves to the message id it failed with, or null; a throw is the default. */
  const run = async (method: string, task: () => Promise<string | null>) => {
    if (inFlightRef.current) return;

    inFlightRef.current = true;
    setRunning(method);
    setFailure(null);

    let messageId: string | null;

    // The React Compiler can't take a `finally`; the catch takes every throw, so the release follows.
    try {
      messageId = await task();
    } catch (error) {
      log.error({ error, method }, "Auth attempt threw");
      messageId = DEFAULT_FAILURE;
    }

    if (messageId !== null) setFailure({ method, message: intl.formatMessage({ id: messageId }) });

    inFlightRef.current = false;
    setRunning(null);
  };

  /** Runs a Better Auth call, its refusal translated by `authFailure`. */
  const attempt = (method: string, call: AuthCall, fallback = DEFAULT_FAILURE) =>
    run(method, () => authFailure(call(), fallback));

  /** The failure when one of `methods` raised it, for the form that shows those methods. */
  const failureFor = (...methods: string[]) =>
    failure !== null && methods.includes(failure.method) ? failure : null;

  return { running, failure, run, attempt, failureFor };
}

export type AuthAttempt = ReturnType<typeof useAuthAttempt>;
