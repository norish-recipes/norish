"use client";

import type { ReactNode } from "react";
import { ExclamationTriangleIcon } from "@heroicons/react/20/solid";
import { Alert } from "@heroui/react";

interface AuthAlertProps {
  status?: "danger" | "warning";
  title: string;
  description: ReactNode;
  icon?: ReactNode;
}

/** The one shape an auth-page failure takes: an alert with an indicator and a title. */
export function AuthAlert({ status = "danger", title, description, icon }: AuthAlertProps) {
  return (
    <Alert className="bg-default" status={status}>
      <Alert.Indicator>{icon ?? <ExclamationTriangleIcon className="size-5" />}</Alert.Indicator>
      <Alert.Content>
        <Alert.Title>{title}</Alert.Title>
        <Alert.Description>{description}</Alert.Description>
      </Alert.Content>
    </Alert>
  );
}
