/**
 * Test cases for AI's parent suggestions, for the local dev database: flagged
 * foods, owned by the first user so they may be edited, each an obvious kind
 * of a food the seed already has. Prints SQL; nothing is written here.
 *
 *   pnpm --filter @norish/shared exec tsx ../../.scratch/ingredient-catalogue/fixtures/parent-cases.ts \
 *     | docker exec -i norish-db-local psql -U postgres norish
 *
 * Re-runnable: a name already in the catalogue is skipped. `--remove` prints
 * the SQL that deletes them again.
 */
import { foldName } from "../../../packages/shared/src/lib/fold-name";

/** [the flagged food, the parent AI should suggest] */
const CASES: Array<[string, string]> = [
  ["sweet chilli dipping sauce", "sweet chilli sauce"],
  ["chicken thighs", "chicken"],
  ["beef brisket", "beef"],
  ["grated parmesan", "cheese"],
  ["sourdough bread", "bread"],
  ["jasmine rice", "rice"],
  ["oyster mushrooms", "mushroom"],
  ["garlic cloves", "garlic"],
  ["vine tomatoes", "tomato"],
  ["unsalted butter", "butter"],
];

const quote = (text: string) => `'${text.replace(/'/g, "''")}'`;
const fold = (text: string) => foldName(text) || text.trim().toLowerCase();

if (process.argv.includes("--remove")) {
  console.log(
    `delete from ingredients where owner_id is not null and name in (${CASES.map(([name]) => quote(name)).join(", ")});`
  );
} else {
  console.log("begin;");
  for (const [name, parent] of CASES) {
    console.log(`-- ${name}: expect a kind of ${parent}
with owner as (select id from "user" order by "createdAt" limit 1),
fresh as (
  insert into ingredients (name, owner_id, flagged, flag_reason)
  select ${quote(name)}, owner.id, true, 'ai-unsure' from owner
  where not exists (select 1 from ingredient_aliases where fold = ${quote(fold(name))})
    and not exists (select 1 from ingredients where lower(name) = lower(${quote(name)}))
  returning id, owner_id
)
insert into ingredient_aliases (text, fold, locale, ingredient_id, owner_id)
select ${quote(name)}, ${quote(fold(name))}, 'en', id, owner_id from fresh;`);
  }
  console.log("commit;");
}
