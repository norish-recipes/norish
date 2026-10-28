"use client";

import { useState } from "react";
import { ActionButton, ActionButtonGroup } from "@/components/shared/action-button";
import UiSwitch from "@/components/shared/ui-switch";
import { KeyIcon } from "@heroicons/react/16/solid";
import { Description, FieldError, Input, Label, Modal, TextField, toast } from "@heroui/react";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { authClient } from "@norish/shared/lib/auth/client";

interface ChangePasswordModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function ChangePasswordModal({ isOpen, onOpenChange }: ChangePasswordModalProps) {
  return (
    <Modal.Backdrop className="z-[1099]" isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container className="z-[1100]">
        <Modal.Dialog>
          {/* The form mounts per opening, so a closed dialog keeps no password. */}
          {({ close }) => <ChangePasswordForm close={close} />}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function ChangePasswordForm({ close }: { close: () => void }) {
  const t = useTranslations("settings.user.signInMethods");
  const tSignup = useTranslations("auth.signup");
  const tActions = useTranslations("common.actions");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [revokeOtherSessions, setRevokeOtherSessions] = useState(true);
  const [wrongPassword, setWrongPassword] = useState(false);
  const tooShort = newPassword.length > 0 && newPassword.length < 8;
  const tooLong = newPassword.length > 128;
  const mismatch = confirmation.length > 0 && confirmation !== newPassword;
  const isValid =
    currentPassword && newPassword && !tooShort && !tooLong && confirmation === newPassword;

  const change = useMutation({
    mutationFn: async () => {
      const { error } = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast(t("passwordChanged"), { variant: "success" });
      close();
    },
    onError: (error: { code?: string }) => {
      if (error.code === "INVALID_PASSWORD") setWrongPassword(true);
      else toast(t("errors.changeFailed"), { variant: "danger" });
    },
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (isValid) change.mutate();
      }}
    >
      <Modal.Header>{t("changePassword")}</Modal.Header>
      <Modal.Body className="flex flex-col gap-4">
        <TextField
          fullWidth
          isRequired
          isInvalid={wrongPassword}
          type="password"
          value={currentPassword}
          onChange={(value) => {
            setCurrentPassword(value);
            setWrongPassword(false);
          }}
        >
          <Label>{t("currentPassword")}</Label>
          <Input autoComplete="current-password" variant="secondary" />
          <FieldError>{t("errors.wrongPassword")}</FieldError>
        </TextField>
        <TextField
          fullWidth
          isRequired
          isInvalid={tooShort || tooLong}
          type="password"
          value={newPassword}
          onChange={setNewPassword}
        >
          <Label>{t("newPassword")}</Label>
          <Input autoComplete="new-password" variant="secondary" />
          <Description>{tSignup("passwordDescription")}</Description>
          <FieldError>
            {tooLong ? tSignup("errors.passwordTooLong") : tSignup("errors.passwordTooShort")}
          </FieldError>
        </TextField>
        <TextField
          fullWidth
          isRequired
          isInvalid={mismatch}
          type="password"
          value={confirmation}
          onChange={setConfirmation}
        >
          <Label>{t("confirmPassword")}</Label>
          <Input autoComplete="new-password" variant="secondary" />
          <FieldError>{tSignup("errors.passwordMismatch")}</FieldError>
        </TextField>
        {/* Label and switch sit together at the row's end; the whole row still toggles. */}
        <UiSwitch
          className="w-full [&_[data-slot=switch-content]]:w-full [&_[data-slot=switch-content]]:flex-row-reverse"
          isSelected={revokeOtherSessions}
          onValueChange={setRevokeOtherSessions}
        >
          <Label>{t("signOutOthers")}</Label>
        </UiSwitch>
      </Modal.Body>
      <Modal.Footer>
        <ActionButtonGroup>
          <ActionButton action="cancel" onPress={close}>
            {tActions("cancel")}
          </ActionButton>
          <ActionButton
            action="save"
            icon={KeyIcon}
            isDisabled={!isValid}
            isPending={change.isPending}
            type="submit"
          >
            {t("changePassword")}
          </ActionButton>
        </ActionButtonGroup>
      </Modal.Footer>
    </form>
  );
}
