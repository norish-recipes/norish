"use client";

import { useState } from "react";
import { Input, Button, Link } from "@heroui/react";
import { EnvelopeIcon, LockClosedIcon, UserIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";

import { signUp } from "@/lib/auth/client";

interface SignupFormProps {
  callbackUrl?: string;
}

export function SignupForm({ callbackUrl = "/" }: SignupFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordsMatch = password === confirmPassword;
  const isFormValid = name && email && password && confirmPassword && passwordsMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!passwordsMatch) {
      setError("Passwords do not match");

      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");

      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await signUp.email({
        name,
        email,
        password,
        callbackURL: callbackUrl,
      });

      if (result.error) {
        setError(result.error.message || "Failed to create account");
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
        autoComplete="name"
        label="Name"
        placeholder="Your name"
        startContent={<UserIcon className="text-default-400 h-4 w-4" />}
        type="text"
        value={name}
        onValueChange={(value) => {
          setName(value);
          setError(null);
        }}
      />

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
        autoComplete="new-password"
        description="At least 8 characters"
        label="Password"
        placeholder="Create a password"
        startContent={<LockClosedIcon className="text-default-400 h-4 w-4" />}
        type="password"
        value={password}
        onValueChange={(value) => {
          setPassword(value);
          setError(null);
        }}
      />

      <Input
        isRequired
        autoComplete="new-password"
        label="Confirm Password"
        placeholder="Confirm your password"
        startContent={<LockClosedIcon className="text-default-400 h-4 w-4" />}
        type="password"
        value={confirmPassword}
        onValueChange={(value) => {
          setConfirmPassword(value);
          setError(null);
        }}
      />

      {error && <p className="text-small text-danger text-center">{error}</p>}

      <Button
        className="mt-2"
        color="primary"
        isDisabled={!isFormValid}
        isLoading={isLoading}
        type="submit"
      >
        Create account
      </Button>

      <p className="text-small text-default-500 text-center">
        Already have an account?{" "}
        <Link
          className="text-small"
          href={`/login${callbackUrl !== "/" ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`}
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
