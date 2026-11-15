export type PhotoSource = "library" | "camera";

export type PhotoPick<T> =
  { kind: "picked"; assets: T[] } | { kind: "cancelled" } | { kind: "failed" };

/** The camera is offered only where one exists: UIKit raises an uncatchable exception without it. */
export function photoSources(hasCamera: boolean): PhotoSource[] {
  return hasCamera ? ["library", "camera"] : ["library"];
}

/** Runs a picker and turns its result or rejection into one outcome the caller handles. */
export async function settlePhotoPick<T>(
  pick: () => Promise<{ canceled: boolean; assets: T[] | null }>
): Promise<PhotoPick<T>> {
  try {
    const result = await pick();
    const assets = result.canceled ? [] : (result.assets ?? []);

    return assets.length > 0 ? { kind: "picked", assets } : { kind: "cancelled" };
  } catch {
    return { kind: "failed" };
  }
}
