/** The host a Server Address names, such as `norish.example.com` or `localhost:3000`. */
export function hostOf(address: string): string {
  try {
    return new URL(address).host || address;
  } catch {
    return address;
  }
}
