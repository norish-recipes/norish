"use client";

import { AuthCard } from "../../components/auth-card";

import { SignupForm } from "./signup-form";

interface SignupClientProps {
  callbackUrl?: string;
}

export function SignupClient({ callbackUrl = "/" }: SignupClientProps) {
  return (
    <AuthCard subtitle="Create your account to get started." title="Sign up for">
      <SignupForm callbackUrl={callbackUrl} />
    </AuthCard>
  );
}
