/**
 * Test case for a round of Ask AI that should suggest one parent for many
 * foods, as if a food (beef by default) had been deleted and added again: the
 * food itself is flagged with no parent, as a fresh mint is, and every kind of
 * it loses its parent and is flagged. Prints SQL for
 * the local dev database; nothing is written here.
 *
 *   pnpm --filter @norish/shared exec tsx ../../.scratch/ingredient-catalogue/fixtures/orphan-kinds.ts [food] \
 *     | docker exec -i norish-db-local psql -U postgres norish
 *
 * The foods are recorded in `_orphaned_kinds`, so `--restore [food]` puts
 * back under the parent the ones no suggestion has placed yet, unflags them,
 * and files the food itself back where it was.
 * `parent_chosen` is set so a seed refresh in between does not re-file them
 * behind the test's back.
 */
const args = process.argv.slice(2);
const restore = args.includes("--restore");
const parent = (args.find((arg) => !arg.startsWith("--")) ?? "beef").replace(/'/g, "''");
const food = `(select id from ingredients where lower(name) = lower('${parent}'))`;

console.log(`begin;
create table if not exists _orphaned_kinds (ingredient_id uuid primary key, parent_id uuid not null);
create table if not exists _orphaned_foods (ingredient_id uuid primary key, parent_id uuid);`);

if (restore) {
  console.log(`update ingredients i
set parent_id = o.parent_id, flagged = false, flag_reason = null, version = i.version + 1
from _orphaned_kinds o
where o.ingredient_id = i.id and i.parent_id is null
  and o.parent_id = (select id from ingredients where lower(name) = lower('${parent}'));
delete from _orphaned_kinds where parent_id = ${food};
update ingredients i
set parent_id = o.parent_id, flagged = false, flag_reason = null, version = i.version + 1
from _orphaned_foods o
where o.ingredient_id = i.id and i.id = ${food} and i.parent_id is null;
delete from _orphaned_foods where ingredient_id = ${food};`);
} else {
  console.log(`insert into _orphaned_kinds (ingredient_id, parent_id)
select c.id, c.parent_id from ingredients c
where c.parent_id = (select id from ingredients where lower(name) = lower('${parent}'))
on conflict do nothing;
update ingredients
set parent_id = null, parent_chosen = true, flagged = true, flag_reason = 'ai-unsure', version = version + 1
where id in (select ingredient_id from _orphaned_kinds
             where parent_id = (select id from ingredients where lower(name) = lower('${parent}')));
insert into _orphaned_foods (ingredient_id, parent_id)
select id, parent_id from ingredients where id = ${food}
on conflict do nothing;
update ingredients
set parent_id = null, parent_chosen = true, flagged = true, flag_reason = 'ai-unsure', version = version + 1
where id = ${food};
select name, flagged, parent_id is null as no_parent from ingredients
where id = ${food} or id in (select ingredient_id from _orphaned_kinds) order by name;`);
}
console.log("commit;");
