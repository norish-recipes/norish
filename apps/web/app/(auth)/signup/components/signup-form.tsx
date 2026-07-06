"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EnvelopeIcon, LockClosedIcon, UserIcon } from "@heroicons/react/24/outline";
import { Button, Description, FieldError, InputGroup, Label, Link, TextField } from "@heroui/react";
import { useTranslations } from "next-intl";

import { signUp } from "@norish/shared/lib/auth/client";

interface SignupFormProps {
  callbackUrl?: string;
}
export function SignupForm({ callbackUrl = "/" }: SignupFormProps) {
  const t = useTranslations("auth.signup");
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
      setError(t("errors.passwordMismatch"));
      return;
    }
    if (password.length < 8) {
      setError(t("errors.passwordTooShort"));
      return;
    }
    if (password.length > 128) {
      setError(t("errors.passwordTooLong"));
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
        setError(result.error.message || t("errors.createFailed"));
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
        name="name"
        type="text"
        variant="secondary"
        value={name}
        onChange={(value) => {
          setName(value);
          setError(null);
        }}
      >
        <Label>{t("name")}</Label>
        <InputGroup fullWidth variant="secondary">
          <InputGroup.Prefix>
            <UserIcon className="text-muted h-4 w-4" />
          </InputGroup.Prefix>
          <InputGroup.Input autoComplete="name" placeholder={t("namePlaceholder")} />
        </InputGroup>
        <FieldError />
      </TextField>

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
          <InputGroup.Input autoComplete="new-password" placeholder={t("passwordPlaceholder")} />
        </InputGroup>
        <Description>{t("passwordDescription")}</Description>
        <FieldError />
      </TextField>

      <TextField
        fullWidth
        isRequired
        name="confirmPassword"
        type="password"
        variant="secondary"
        value={confirmPassword}
        onChange={(value) => {
          setConfirmPassword(value);
          setError(null);
        }}
      >
        <Label>{t("confirmPassword")}</Label>
        <InputGroup fullWidth variant="secondary">
          <InputGroup.Prefix>
            <LockClosedIcon className="text-muted h-4 w-4" />
          </InputGroup.Prefix>
          <InputGroup.Input
            autoComplete="new-password"
            placeholder={t("confirmPasswordPlaceholder")}
          />
        </InputGroup>
        <FieldError />
      </TextField>

      {error && <p className="text-danger text-center text-sm">{error}</p>}

      <Button
        className="mt-2"
        isDisabled={!isFormValid}
        isPending={isLoading}
        type="submit"
        variant="primary"
      >
        {t("createAccount")}
      </Button>

      <p className="text-muted text-center text-sm">
        {t("hasAccount")}{" "}
        <Link
          className="text-sm"
          href={`/login${callbackUrl !== "/" ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`}
        >
          {t("signIn")}
        </Link>
      </p>
    </form>
  );
}
