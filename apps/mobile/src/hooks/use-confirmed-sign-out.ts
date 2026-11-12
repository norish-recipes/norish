import { Alert } from "react-native";
import { getAuthTransportSnapshot } from "@/lib/auth/auth-session-sync";
import { offlineEngine } from "@/lib/offline/engine";
import { useIntl } from "react-intl";

import { useSignOut } from "@norish/shared-react/reader";

/**
 * Sign-out, confirming first when unsynced work would be lost (ADR-0009); resolves whether it left.
 * `onLeaving` runs once the Sign-out goes ahead.
 */
export function useConfirmedSignOut(): (onLeaving?: () => void) => Promise<boolean> {
  const intl = useIntl();
  const signOut = useSignOut();

  return async (onLeaving) => {
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

    if (unsynced === 0) return leave(false);

    return new Promise<boolean>((resolve) =>
      Alert.alert(
        intl.formatMessage({ id: "navbar.userMenu.signOutConfirm.title" }),
        intl.formatMessage(
          { id: "navbar.userMenu.signOutConfirm.description" },
          { count: unsynced }
        ),
        [
          {
            text: intl.formatMessage({ id: "common.actions.cancel" }),
            style: "cancel",
            onPress: () => resolve(false),
          },
          {
            text: intl.formatMessage({ id: "navbar.userMenu.logout" }),
            style: "destructive",
            onPress: () => void leave(true).then(resolve),
          },
        ]
      )
    );
  };
}
