"use client";

import { useState } from "react";
import { Input, Button, Link } from "@heroui/react";
import { EnvelopeIcon, LockClosedIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";

import { signIn } from "@/lib/auth/client";

interface EmailPasswordFormProps {
  callbackUrl?: string;
  registrationEnabled?: boolean;
}

export function EmailPasswordForm({
  callbackUrl = "/",
  registrationEnabled = false,
}: EmailPasswordFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const result = await signIn.email({
        email,
        password,
        callbackURL: callbackUrl,
      });

      if (result.error) {
        setError(result.error.message || "Invalid email or password");
      } else {
        router.push(callbackUrl);
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <Input
        isRequired
        autoComplete="email"
        label="Email"
        placeholder="you@example.com"
        startContent={<EnvelopeIcon className="text-default-400 h-4 w-4" />}
        type="email"
        value={email}
        onValueChange={(value) => {
          setEmail(value);
          setError(null);
        }}
      />

      <Input
        isRequired
        autoComplete="current-password"
        label="Password"
        placeholder="Enter your password"
        startContent={<LockClosedIcon className="text-default-400 h-4 w-4" />}
        type="password"
        value={password}
        onValueChange={(value) => {
          setPassword(value);
          setError(null);
        }}
      />

      {error && <p className="text-small text-danger text-center">{error}</p>}

      <Button
        className="mt-2"
        color="primary"
        isDisabled={!email || !password}
        isLoading={isLoading}
        type="submit"
      >
        Sign in
      </Button>

      {registrationEnabled && (
        <p className="text-small text-default-500 text-center">
          {`Don't have an account? `}
          <Link
            className="text-small"
            href={`/signup${callbackUrl !== "/" ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`}
          >
            Sign up
          </Link>
        </p>
      )}
    </form>
  );
}
