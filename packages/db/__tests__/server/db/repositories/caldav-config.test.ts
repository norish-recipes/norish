// @vitest-environment node

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  getCaldavConfigDecrypted,
  getCaldavConfigWithoutPassword,
  saveCaldavConfig,
} from "@norish/db/repositories/caldav-config";

import { RepositoryTestBase } from "../../../helpers/repository-test-base";

const PEM = "-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----\n";

describe("CalDAV config trusted certificate", () => {
  const testBase = new RepositoryTestBase("caldav_config");
  let userId: string;

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    const [user] = await testBase.beforeEachTest();

    userId = user.id;
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  function save(trustedCertificate: string | null) {
    return saveCaldavConfig(userId, {
      serverUrl: "https://nextcloud.internal/remote.php/dav",
      username: "chef",
      password: "secret",
      trustedCertificate,
      enabled: false,
      breakfastTime: "07:00-08:00",
      lunchTime: "12:00-13:00",
      dinnerTime: "18:00-19:00",
      snackTime: "15:00-16:00",
    });
  }

  it("stores it encrypted and reads it back, with or without the password", async () => {
    const saved = await save(PEM);

    expect(saved.stale).toBe(false);
    expect(saved.stale ? null : saved.value.trustedCertificateEnc).not.toContain("BEGIN");
    expect((await getCaldavConfigDecrypted(userId))?.trustedCertificate).toBe(PEM);

    const withoutPassword = await getCaldavConfigWithoutPassword(userId);

    expect(withoutPassword?.trustedCertificate).toBe(PEM);
    expect(withoutPassword).not.toHaveProperty("password");
  });

  it("forgets it when a save carries none", async () => {
    await save(PEM);
    await save(null);

    expect((await getCaldavConfigDecrypted(userId))?.trustedCertificate).toBeNull();
  });
});
