/**
 * Version comparison utilities.
 */

/**
 * Compare versions to determine if update is available.
 * Handles semver format with optional suffix (e.g., 0.15.1-beta).
 */
export function isUpdateAvailable(current: string, latest: string | null): boolean {
  if (!latest) return false;

  // Normalize: extract major.minor.patch as numbers
  const normalize = (v: string): [number, number, number] => {
    const base = v.replace(/-.*$/, ""); // Strip suffix like -beta
    const parts = base.split(".").map(Number);

    return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
  };

  const [cMaj, cMin, cPatch] = normalize(current);
  const [lMaj, lMin, lPatch] = normalize(latest);

  // Compare major.minor.patch
  if (lMaj > cMaj) return true;
  if (lMaj < cMaj) return false;
  if (lMin > cMin) return true;
  if (lMin < cMin) return false;
  if (lPatch > cPatch) return true;

  return false;
}
