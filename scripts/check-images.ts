import { initializeServerConfig } from "@norish/config/env-config-server";
import { db } from "@norish/db";

async function main() {
  const config = initializeServerConfig();
  console.log("SERVER_CONFIG.UPLOADS_DIR =", config.UPLOADS_DIR);
  
  const recipes = await db.query.recipes.findMany({
    columns: { id: true, name: true, image: true },
    limit: 5,
  });
  console.log("Recipes:");
  console.log(recipes);
  process.exit(0);
}
main();
