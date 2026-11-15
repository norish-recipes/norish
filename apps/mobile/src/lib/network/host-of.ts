/** Whether a value is an absolute http(s) link rather than a server path or a label. */
export function isWebLink(value: string): boolean {
  return /^https?:\/\//.test(value);
}

/** The host a Server Address names, such as `norish.example.com` or `localhost:3000`. */
export function hostOf(address: string): string {
  try {
    return new URL(address).host || address;
  } catch {
    return address;
  }
}

/** A link or host as people say it, without the scheme or `www.`: `example.com/pasta`. */
export function plainLink(value: string): string {
  return value.replace(/^(https?:\/\/)?(www\.)?/, "");
}
