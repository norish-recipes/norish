import { QuerySeed } from "@/components/query-seed";

import UserSettingsContent from "./components/user-settings-content";

// `user.get` carries API-key metadata, which this tab draws anyway.
export default function AccountSettingsPage() {
  return (
    <QuerySeed
      reads={(trpc, client) => [
        client.query(trpc.user.get.queryOptions()),
        client.query(trpc.user.getAllergies.queryOptions()),
        client.query(trpc.recipes.shareListMine.queryOptions()),
        client.query(trpc.siteAuthTokens.list.queryOptions()),
        client.query(trpc.config.localeConfig.queryOptions()),
        client.query(trpc.config.timersEnabled.queryOptions()),
        client.query(trpc.config.authProviders.queryOptions()),
        client.query(trpc.user.signInMethods.queryOptions()),
      ]}
    >
      <UserSettingsContent />
    </QuerySeed>
  );
}
