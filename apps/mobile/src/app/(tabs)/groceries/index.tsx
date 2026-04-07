import React from "react";
import { SimpleTabScreen } from "@/components/shell/simple-tab-screen";

export default function GroceriesScreen() {
  return (
    <SimpleTabScreen
      title="Groceries"
      subtitle="Plan your next store run quickly."
      body="Track store lists and prep ingredients here."
    />
  );
}
