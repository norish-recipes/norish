import { Alert } from "react-native";
import { useCancelButton } from "@/hooks/use-cancel-button";
import { getAuthTransportSnapshot } from "@/lib/auth/auth-session-sync";
import { leaveConfirm } from "@/lib/discard-confirm";
import { offlineEngine } from "@/lib/offline/engine";
import { useIntl } from "react-intl";

import { useSignOut } from "@norish/shared-react/reader";

/**
 * Sign-out, confirming first when unsynced work would be lost (ADR-0009); resolves whether it left.
 * `onLeaving` runs once the Sign-out goes ahead; `serverChange` adds a warning when nothing is unsynced.
 */
export function useConfirmedSignOut(): (
  onLeaving?: () => void,
  serverChange?: boolean
) => Promise<boolean> {
  const intl = useIntl();
  const signOut = useSignOut();
  const cancel = useCancelButton();

  return async (onLeaving, serverChange = false) => {
    // The session this was asked for; once it has ended (Session Expiry), there is nothing to leave.
    const { version } = getAuthTransportSnapshot();

    // A cancelled confirm, a failed sign-out or one already running all leave the session up.
    const leave = async (discardQueue: boolean) => {
      if (getAuthTransportSnapshot().version !== version) return false;

      onLeaving?.();
      await signOut({ discardQueue });

      return !getAuthTransportSnapshot().hasActiveSession;
    };

    const unsynced = await offlineEngine.unsyncedChanges();

    const confirm = leaveConfirm(unsynced, serverChange);

    if (confirm === null) return leave(false);

    const discard = confirm === "discard";

    return new Promise<boolean>((resolve) =>
      Alert.alert(
        intl.formatMessage({
          id: discard
            ? "navbar.userMenu.signOutConfirm.title"
            : "settings.mobile.changeServer.title",
        }),
        discard
          ? intl.formatMessage(
              { id: "navbar.userMenu.signOutConfirm.description" },
              { count: unsynced }
            )
          : intl.formatMessage({ id: "settings.mobile.changeServer.description" }),
        [
          { ...cancel, onPress: () => resolve(false) },
          {
            text: intl.formatMessage({
              id: discard ? "navbar.userMenu.logout" : "settings.mobile.changeServer.action",
            }),
            style: "destructive",
            onPress: () => void leave(discard).then(resolve),
          },
        ]
      )
    );
  };
}
