export type CoverSource = "library" | "camera";

export type CoverPick =
  { kind: "picked"; uri: string } | { kind: "cancelled" } | { kind: "failed" };

/** The camera is offered only where one exists: UIKit raises an uncatchable exception without it. */
export function coverSources(hasCamera: boolean): CoverSource[] {
  return hasCamera ? ["library", "camera"] : ["library"];
}

/** Runs a picker and turns its result or rejection into one outcome the caller handles. */
export async function settleCoverPick(
  pick: () => Promise<{ canceled: boolean; assets: { uri: string }[] | null }>
): Promise<CoverPick> {
  try {
    const result = await pick();
    const asset = result.canceled ? undefined : result.assets?.[0];

    return asset ? { kind: "picked", uri: asset.uri } : { kind: "cancelled" };
  } catch {
    return { kind: "failed" };
  }
}
