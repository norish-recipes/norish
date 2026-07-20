"use client";

import type { WebConnectivitySnapshot } from "@/lib/connectivity";
import { useCallback, useState } from "react";
import { webConnectivityRuntime } from "@/lib/connectivity";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { Switch } from "@heroui/react";
import { useTranslations } from "next-intl";

type SimulatorSectionProps = {
  connectivity: WebConnectivitySnapshot;
};

export function SimulatorSection({ connectivity }: SimulatorSectionProps) {
  const t = useTranslations("navbar.offline");
  const [simulationFailed, setSimulationFailed] = useState(false);
  const [simulationPending, setSimulationPending] = useState(false);
  const setSimulation = useCallback(async (enabled: boolean) => {
    setSimulationPending(true);
    setSimulationFailed(false);
    const succeeded = await webConnectivityRuntime.setSimulatedBackendUnavailable(enabled);

    setSimulationFailed(!succeeded);
    setSimulationPending(false);
  }, []);

  return (
    <section
      data-development-simulator
      aria-labelledby="offline-simulation-heading"
      className="border-border mt-5 border-t pt-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold" id="offline-simulation-heading">
            {t("simulation.title")}
          </h3>
          <p className="text-muted mt-1 text-sm">{t("simulation.description")}</p>
        </div>
        <Switch
          aria-label={t("simulation.title")}
          isDisabled={simulationPending}
          isSelected={connectivity.simulatedBackendUnavailable}
          onChange={(selected) => void setSimulation(selected)}
        >
          <Switch.Content>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
          </Switch.Content>
        </Switch>
      </div>
      {simulationFailed ? (
        <p className="text-danger mt-2 flex items-center gap-1 text-sm">
          <ExclamationTriangleIcon className="size-4" />
          {t("simulation.disableFailed")}
        </p>
      ) : null}
    </section>
  );
}
