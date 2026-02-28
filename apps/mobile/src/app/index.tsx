import { Redirect } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { loadBackendBaseUrl } from '@/lib/network/backend-base-url';

export default function IndexRoute() {
  const [targetRoute, setTargetRoute] = useState<'/connect' | '/recipes' | null>(null);

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      const savedBaseUrl = await loadBackendBaseUrl();

      if (!isMounted) {
        return;
      }

      setTargetRoute(savedBaseUrl ? '/recipes' : '/connect');
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  if (!targetRoute) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return <Redirect href={targetRoute} />;
}
