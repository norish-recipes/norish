import { db } from "@norish/db/client";
import { recipes } from "@norish/db/schema";
import { sql } from "drizzle-orm";

async function main() {
  const result = await db.select({ id: recipes.id, name: recipes.name, image: recipes.image }).from(recipes).limit(5);
  console.log(result);
  process.exit(0);
}
main();
