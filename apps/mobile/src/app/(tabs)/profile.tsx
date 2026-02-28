import React from 'react';

import { SimpleTabScreen } from '@/components/shell/simple-tab-screen';

export default function ProfileScreen() {
  return (
    <SimpleTabScreen
      title="Profile"
      subtitle="Account details and personal preferences."
      body="Manage profile details and account-level preferences."
    />
  );
}
