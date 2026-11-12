import { useRef, useState } from "react";
import { authFailure } from "@/features/auth/utils/auth-failure";
import { useIntl } from "react-intl";

type AuthCall = () => Promise<{ error: { code?: string; message?: string } | null }>;

/** A failed attempt and the method it came from; each is a new object, so it shakes again. */
export type AuthAttemptFailure = { method: string; message: string } | null;

/**
 * A form's Better Auth calls: one in flight at a time, every method waiting on it, and one
 * translated inline error, cleared as the next attempt starts.
 */
export function useAuthAttempt() {
  const intl = useIntl();
  const [running, setRunning] = useState<string | null>(null);
  const [failure, setFailure] = useState<AuthAttemptFailure>(null);
  // State lands on the next render, so a second tap or return key in the same tick reads this.
  const inFlightRef = useRef(false);

  const attempt = async (
    method: string,
    call: AuthCall,
    fallback = "auth.errors.default.description"
  ) => {
    if (inFlightRef.current) return;

    inFlightRef.current = true;
    setRunning(method);
    setFailure(null);

    const messageId = await authFailure(call(), fallback);

    if (messageId !== null) setFailure({ method, message: intl.formatMessage({ id: messageId }) });

    inFlightRef.current = false;
    setRunning(null);
  };

  /** The failure when one of `methods` raised it, for the form that shows those methods. */
  const failureFor = (...methods: string[]) =>
    failure !== null && methods.includes(failure.method) ? failure : null;

  return { running, failure, attempt, failureFor };
}

export type AuthAttempt = ReturnType<typeof useAuthAttempt>;
