export * from "./logger";

export type AppVersions = {
  root: string;
  apps: Record<string, string>;
  packages: Record<string, string>;
};

const unavailableVersions: AppVersions = {
  root: "unavailable",
  apps: {},
  packages: {},
};

function parseVersionReport(value: string | undefined): AppVersions {
  if (!value?.trim()) {
    return unavailableVersions;
  }

  let parsed: Partial<AppVersions>;

  try {
    parsed = JSON.parse(value) as Partial<AppVersions>;
  } catch {
    return unavailableVersions;
  }

  return {
    root: typeof parsed.root === "string" ? parsed.root : unavailableVersions.root,
    apps: isVersionMap(parsed.apps) ? parsed.apps : unavailableVersions.apps,
    packages: isVersionMap(parsed.packages) ? parsed.packages : unavailableVersions.packages,
  };
}

function isVersionMap(value: unknown): value is Record<string, string> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((version) => typeof version === "string")
  );
}

export function getAppVersions() {
  return parseVersionReport(process.env.NORISH_VERSION_REPORT_JSON);
}
