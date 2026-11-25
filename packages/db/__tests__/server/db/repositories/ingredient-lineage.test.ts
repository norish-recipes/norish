// @vitest-environment node
/** The lineage reads for icons and nutrition, against real Postgres. */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { findIconLineage } from "@norish/db/repositories/ingredient-icons";
import { findNutritionLineage } from "@norish/db/repositories/ingredient-nutrition";
import { ingredients } from "@norish/db/schema";

import { getTestDb } from "../../../helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../helpers/repository-test-base";

const testBase = new RepositoryTestBase("test_ingredient_lineage");

describe("ingredient lineage", () => {
  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    await testBase.beforeEachTest();
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  it("reads more ids than a statement can bind one by one", async () => {
    const [onion] = await getTestDb()
      .insert(ingredients)
      .values({ name: "onion" })
      .returning({ id: ingredients.id });
    // Past PostgreSQL's 65,535 binds: the ids go as one array.
    const ids = [onion!.id, ...Array.from({ length: 70_000 }, () => randomUUID())];

    expect([...(await findIconLineage(ids)).keys()]).toEqual([onion!.id]);
    expect([...(await findNutritionLineage(ids)).keys()]).toEqual([onion!.id]);
  });
});
