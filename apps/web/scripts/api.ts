/** Sign-in and tRPC over HTTP for the measurement scripts. */

/** Signs in with a password; answers the session's cookies. */
export async function signIn(base: string, email: string, password: string) {
  const response = await fetch(`${base}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: base },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) throw new Error(`Sign-in failed: ${response.status}`);

  return response.headers.getSetCookie().map((header) => {
    const [pair = ""] = header.split(";");
    const at = pair.indexOf("=");

    return { name: pair.slice(0, at), value: pair.slice(at + 1) };
  });
}

/** A tRPC query, or with `mutation` a mutation, as the session in `cookie`. */
export async function callTrpc<T>(
  base: string,
  cookie: string,
  procedure: string,
  input?: unknown,
  mutation = false
): Promise<T> {
  const envelope = JSON.stringify({ json: input });
  const response = await fetch(
    `${base}/api/trpc/${procedure}${mutation || input === undefined ? "" : `?input=${encodeURIComponent(envelope)}`}`,
    mutation
      ? { method: "POST", headers: { cookie, "content-type": "application/json" }, body: envelope }
      : { headers: { cookie } }
  );

  if (!response.ok) throw new Error(`${procedure} failed: ${response.status}`);

  return ((await response.json()) as { result: { data: { json: T } } }).result.data.json;
}
