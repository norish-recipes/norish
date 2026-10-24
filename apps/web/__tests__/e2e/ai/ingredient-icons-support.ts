/**
 * Ingredient Icons E2E support: the pictures the scenario uploads and the fake image provider
 * draws, and the procedures it seeds a grocery with and reads a food's own icon back through.
 */
import { randomUUID } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";

import type { AIE2EStack } from "./fixture";
import { callTrpc, queryTrpc } from "../harness/trpc";
import { ingredientIdOf } from "./grocery-aisles-support";

/**
 * A product shot as a person would upload one: a single coloured food on a
 * flat white ground, which the cut-out frees from its background.
 */
export async function pictureOfFood(colour: string): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">
    <rect width="256" height="256" fill="#ffffff"/>
    <circle cx="128" cy="128" r="80" fill="${colour}"/>
  </svg>`;

  return await sharp(Buffer.from(svg)).png().toBuffer();
}

/** The picture written to a file, for a file input to take. */
export async function pictureFile(colour: string): Promise<string> {
  const file = path.join(mkdtempSync(path.join(os.tmpdir(), "norish-icon-")), "food.png");

  writeFileSync(file, await pictureOfFood(colour));

  return file;
}

/** The address of a food's own icon, as the Ingredients page reads it; null for none of its own. */
export async function readOwnIcon(stack: AIE2EStack, name: string): Promise<string | null> {
  const ingredientId = await ingredientIdOf(stack, name);

  if (!ingredientId) return null;
  const food = await queryTrpc<{ icon: string | null; ownIcon: boolean } | null>(
    stack.baseURL,
    stack.ownerCookies,
    "ingredients.get",
    { ingredientId }
  );

  return food?.ownIcon ? food.icon : null;
}

/** A grocery on the owner's list, added as the list adds one. */
export async function seedGrocery(stack: AIE2EStack, name: string): Promise<void> {
  await callTrpc(stack.baseURL, stack.ownerCookies, "groceries.create", [
    { id: randomUUID(), name, unit: null, amount: null },
  ]);
}
