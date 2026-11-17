import type { LaunchPhase } from "@/lib/boot/launch-motion";

/** What the session's ground shows; a pending session is bare only under the launch splash, which has its own loader. */
export function resolveSessionView(
  pending: boolean,
  signedIn: boolean,
  launch: LaunchPhase
): "bare" | "loader" | "signed-in" | "signed-out" {
  if (pending) return launch === "covered" ? "bare" : "loader";

  return signedIn ? "signed-in" : "signed-out";
}
