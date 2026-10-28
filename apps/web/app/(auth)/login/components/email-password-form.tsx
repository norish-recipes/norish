"use client";

import { useState } from "react";
import { usePending } from "@/hooks/use-pending";
import { ArrowRightEndOnRectangleIcon } from "@heroicons/react/16/solid";
import { EnvelopeIcon, LockClosedIcon } from "@heroicons/react/24/outline";
import { Button, FieldError, InputGroup, Label, Link, TextField } from "@heroui/react";
import { useTranslations } from "next-intl";

import { signIn } from "@norish/shared/lib/auth/client";
import { APP_ROOT } from "@norish/shared/lib/base-path";

import { AuthAlert } from "../../components/auth-alert";

interface EmailPasswordFormProps {
  callbackUrl?: string;
  registrationEnabled?: boolean;
}
export function EmailPasswordForm({
  callbackUrl = APP_ROOT,
  registrationEnabled = false,
}: EmailPasswordFormProps) {
  const t = useTranslations("auth.emailPassword");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, whileLoading] = usePending();
  // Set once signed in, so the button stays busy while the redirect loads the app.
  const [isLeaving, setIsLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handleSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault();
    setError(null);
    await whileLoading(() =>
      signIn
        .email({
          email,
          password,
          callbackURL: callbackUrl,
        })
        .then((result) => {
          // On success Better Auth's redirect plugin sets `location.href` to `callbackURL`.
          if (result.error) setError(result.error.message || t("errors.invalidCredentials"));
          else setIsLeaving(true);
        })
        .catch(() => setError(t("errors.generic")))
    );
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <TextField
        fullWidth
        isRequired
        name="email"
        type="email"
        value={email}
        variant="secondary"
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
        value={password}
        variant="secondary"
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

      {error && <AuthAlert description={error} title={t("errors.title")} />}

      <Button
        fullWidth
        className="mt-2 h-11"
        isDisabled={!email || !password}
        isPending={isLoading || isLeaving}
        type="submit"
        variant="primary"
      >
        <ArrowRightEndOnRectangleIcon className="size-4" />
        {t("signIn")}
      </Button>

      {registrationEnabled && (
        <p className="text-muted text-center text-sm">
          {t("noAccount")}{" "}
          <Link
            className="text-sm"
            href={`/signup${callbackUrl !== APP_ROOT ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`}
          >
            {t("signUp")}
          </Link>
        </p>
      )}
    </form>
  );
}
