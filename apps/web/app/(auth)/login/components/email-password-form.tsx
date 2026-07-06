"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EnvelopeIcon, LockClosedIcon } from "@heroicons/react/24/outline";
import { Button, FieldError, InputGroup, Label, Link, TextField } from "@heroui/react";
import { useTranslations } from "next-intl";

import { signIn } from "@norish/shared/lib/auth/client";

interface EmailPasswordFormProps {
  callbackUrl?: string;
  registrationEnabled?: boolean;
}
export function EmailPasswordForm({
  callbackUrl = "/",
  registrationEnabled = false,
}: EmailPasswordFormProps) {
  const t = useTranslations("auth.emailPassword");
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
        setError(result.error.message || t("errors.invalidCredentials"));
      } else {
        router.push(callbackUrl);
      }
    } catch {
      setError(t("errors.generic"));
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <TextField
        fullWidth
        isRequired
        name="email"
        type="email"
        variant="secondary"
        value={email}
        onChange={(value) => {
          setEmail(value);
          setError(null);
        }}
      >
        <Label>{t("email")}</Label>
        <InputGroup fullWidth variant="secondary">
          <InputGroup.Prefix>
            <EnvelopeIcon className="text-muted h-4 w-4" />
          </InputGroup.Prefix>
          <InputGroup.Input autoComplete="email" placeholder={t("emailPlaceholder")} />
        </InputGroup>
        <FieldError />
      </TextField>

      <TextField
        fullWidth
        isRequired
        name="password"
        type="password"
        variant="secondary"
        value={password}
        onChange={(value) => {
          setPassword(value);
          setError(null);
        }}
      >
        <Label>{t("password")}</Label>
        <InputGroup fullWidth variant="secondary">
          <InputGroup.Prefix>
            <LockClosedIcon className="text-muted h-4 w-4" />
          </InputGroup.Prefix>
          <InputGroup.Input
            autoComplete="current-password"
            placeholder={t("passwordPlaceholder")}
          />
        </InputGroup>
        <FieldError />
      </TextField>

      {error && <p className="text-danger text-center text-sm">{error}</p>}

      <Button
        fullWidth
        className="mt-2 h-11"
        isDisabled={!email || !password}
        isPending={isLoading}
        type="submit"
        variant="primary"
      >
        {t("signIn")}
      </Button>

      {registrationEnabled && (
        <p className="text-muted text-center text-sm">
          {t("noAccount")}{" "}
          <Link
            className="text-sm"
            href={`/signup${callbackUrl !== "/" ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`}
          >
            {t("signUp")}
          </Link>
        </p>
      )}
    </form>
  );
}
