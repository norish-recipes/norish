"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { commitHandoffNavigation } from "@/lib/sign-in-handoff";

/**
 * Resolves a pending sign-in view transition once the route has actually
 * changed. Lives in the root layout because the outgoing auth page unmounts
 * mid-transition — only a component that survives the navigation can report
 * that it landed.
 */
export function SignInHandoffCommit() {
  const pathname = usePathname();

  useEffect(() => {
    commitHandoffNavigation();
  }, [pathname]);

  return null;
}
