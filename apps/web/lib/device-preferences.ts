/**
 * Device preferences ride in cookies rather than localStorage, because a
 * cookie is the only device state the server can read while it produces the
 * HTML — anything read after hydration forces the server to guess, and the
 * guess is the flicker the reader watches a frame in. One definition owns
 * the whole shape a preference cookie needs: a parse that always lands on a
 * valid value, the client read and write, and the name a server component
 * reads while seeding the first render. The provider half lives in
 * context/device-preference-context.tsx.
 *
 * Names use underscores — cookie names cannot safely carry the `norish:`
 * colon the localStorage keys used.
 */

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/** The slice of next/headers' ReadonlyRequestCookies a server read needs. */
type RequestCookies = {
  get(name: string): { value: string } | undefined;
};

export type DevicePreferenceDefinition<V extends string> = {
  cookieName: string;
  values: readonly V[];
  defaultValue: V;
  /** Always lands on a valid value; feeds the server render. */
  parse(value: string | null | undefined): V;
  /** The server-side read: seed the first render from the request. */
  readFrom(cookieStore: RequestCookies): V;
  /**
   * The stored choice, or null when this browser has never made one. A
   * present-but-unrecognised value is a made choice with a broken value and
   * parses to the default rather than counting as never-chosen.
   */
  readCookie(): V | null;
  writeCookie(value: V): void;
};

export function defineDevicePreference<V extends string>({
  cookieName,
  values,
  defaultValue,
}: {
  cookieName: string;
  values: readonly V[];
  defaultValue: V;
}): DevicePreferenceDefinition<V> {
  const isValue = (value: unknown): value is V => values.includes(value as V);
  const parse = (value: string | null | undefined): V => (isValue(value) ? value : defaultValue);

  return {
    cookieName,
    values,
    defaultValue,
    parse,
    readFrom(cookieStore) {
      return parse(cookieStore.get(cookieName)?.value);
    },
    readCookie() {
      if (typeof document === "undefined") return null;

      for (const entry of document.cookie.split(";")) {
        const [name, value] = entry.trim().split("=");

        if (name === cookieName) return parse(value);
      }

      return null;
    },
    writeCookie(value: V) {
      if (typeof document === "undefined") return;

      document.cookie = `${cookieName}=${value};path=/;max-age=${COOKIE_MAX_AGE_SECONDS};SameSite=Lax`;
    },
  };
}
