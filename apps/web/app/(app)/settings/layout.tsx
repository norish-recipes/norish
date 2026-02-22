import React from "react";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-6xl pb-4">{children}</div>;
}
