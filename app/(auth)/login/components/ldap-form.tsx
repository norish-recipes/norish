"use client";

import { useState } from "react";
import { Input, Button } from "@heroui/react";
import { UserIcon, LockClosedIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";

interface LdapFormProps {
  callbackUrl?: string;
}

export function LdapForm({ callbackUrl = "/" }: LdapFormProps) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/sign-in/ldap", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          password,
        }),
        credentials: "include",
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        setError(result.error?.message || result.message || "Invalid username or password");
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
        autoComplete="username"
        label="Username"
        placeholder="Your LDAP username"
        startContent={<UserIcon className="text-default-400 h-4 w-4" />}
        type="text"
        value={username}
        onValueChange={(value) => {
          setUsername(value);
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
        isDisabled={!username || !password}
        isLoading={isLoading}
        type="submit"
      >
        Sign in with LDAP
      </Button>
    </form>
  );
}
