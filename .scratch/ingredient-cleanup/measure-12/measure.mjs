/**
 * Tickets 12 and 31: the same counts from a 0.25.1 or a 0.26 database, read-only.
 *   node measure.mjs <database url> [redis url] [server log] > run.json
 *   node measure.mjs compare <label>=<run.json> ... > table.md    (counts only)
 *   node measure.mjs report <label>=<run.json> ... > report.html  (names and line texts too)
 * run.json and the report hold production text: keep them outside the repo, never publish them.
 * The cases come from a private file (MEASURE_CASES, default ~/Documents/norish-ticket-31/cases.json).
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const require = createRequire(join(root, "packages/db/package.json"));

const lc = (text) => (text ?? "").toLowerCase();
const named = (n, name) => n.foods.find((f) => lc(f.name) === name);
const everyLineNames = (n, test) =>
  n.lines.length > 0 && n.lines.every((l) => test(l.foods.map(lc)));

// The cases' texts and lookups are production text, so they live in a private file beside the run
// files: { "<case>": { ticket, lookups, check? } }. The checks below are keyed by the ticket's words.
const casesFile =
  process.env.MEASURE_CASES ?? join(homedir(), "Documents/norish-ticket-31/cases.json");
const CHECKS = {
  "salt cinnamon": {
    expect: "split into its foods, not deleted",
    holds: (n) => !named(n, "salt cinnamon") && everyLineNames(n, (foods) => foods.length >= 2),
  },
  "koud water melk": {
    expect: "split into its foods, not deleted",
    holds: (n) => !named(n, "koud water melk") && everyLineNames(n, (foods) => foods.length >= 2),
  },
  "Nora reserve eten": {
    expect: "kept, hidden, no parent",
    holds: (n) =>
      named(n, "nora reserve eten")?.hidden === true && !named(n, "nora reserve eten").parent,
  },
  "rode pesto": {
    expect: "not merged into red port",
    holds: (n) => everyLineNames(n, (foods) => foods.length > 0 && !foods.includes("red port")),
  },
  "sriracha sauce": {
    expect: "not merged into oyster sauce",
    holds: (n) => everyLineNames(n, (foods) => foods.length > 0 && !foods.includes("oyster sauce")),
  },
  "tortilla's": {
    expect: "on tortilla (or corn tortilla)",
    holds: (n) => everyLineNames(n, (foods) => foods.some((f) => f.endsWith("tortilla"))),
  },
  "chocolate whey": {
    expect: "keeps whey",
    holds: (n) => lc(named(n, "chocolate whey")?.parent) === "whey",
  },
  "Italian herbs": {
    expect: "keeps herb",
    holds: (n) => ["herb", "herbs"].includes(lc(named(n, "italian herbs")?.parent)),
  },
  "chinese 5 spice": {
    expect: "keeps spice",
    holds: (n) => lc(named(n, "chinese 5 spice")?.parent) === "spice",
  },
  "Denta tix": {
    expect: "loses tea",
    holds: (n) => lc(named(n, "denta tix")?.parent) !== "tea",
  },
  "ground cumin": {
    expect: "under cumin",
    holds: (n) =>
      n.foods.length > 0 &&
      n.foods.every((f) => lc(f.name) === "cumin" || lc(f.parent) === "cumin"),
  },
  "mango blokjes": {
    expect: "under mango",
    holds: (n) => lc(named(n, "mango blokjes")?.parent) === "mango",
  },
  "light cooking cream or non-fat Greek yogurt": {
    // The new food may then be merged by AI's pass ("light cream"), so any cream food counts.
    expect: "split; the cream lines on a cream food of their own",
    holds: (n) =>
      !named(n, "light cooking cream or non-fat greek yogurt") &&
      everyLineNames(n, (foods) => foods.some((f) => f.includes("cream"))) &&
      n.lines.every((l) => !/ or /i.test(l.text) || l.joined === "alternatives"),
  },
  "colon lines": {
    expect: "no line ending in a colon names a food",
    holds: (_n, counts) => !counts.lines["colon line, with a food"],
  },
};

// A check the private file gives a case, on the food named its first lookup.
const KINDS = {
  parent: (want) => [`under ${want}`, (n, food) => lc(named(n, food)?.parent) === want],
  notParent: (want) => [`not under ${want}`, (n, food) => lc(named(n, food)?.parent) !== want],
  hasParent: () => ["keeps a parent", (n, food) => Boolean(named(n, food)?.parent)],
  notFlagged: () => ["no food flagged", (n) => n.foods.every((f) => !f.flagged)],
  // Every line names a food matching each pattern / none named `want`.
  linesName: (wants) => [
    `every line names ${wants.join(" and ")}`,
    (n) =>
      everyLineNames(n, (foods) => wants.every((w) => foods.some((f) => new RegExp(w).test(f)))),
  ],
  linesNot: (want) => [
    `no line on ${want}`,
    (n) => n.lines.every((l) => !l.foods.map(lc).includes(want)),
  ],
  noSpelling: (texts) => [
    `no spelling ${texts.join(", ")}`,
    (n) => !n.spellings.some((s) => texts.includes(lc(s.text))),
  ],
  // The lookups' own spellings all name one food.
  sameFood: () => [
    "the copies are one food",
    (n, _food, lookups) =>
      new Set(n.spellings.filter((s) => lookups.includes(lc(s.text))).map((s) => s.food)).size ===
      1,
  ],
};
const CASES = Object.fromEntries(
  Object.entries(JSON.parse(readFileSync(casesFile, "utf8"))).map(([text, c]) => {
    const tests = Object.entries(c.check ?? {}).map(([kind, arg]) => KINDS[kind](arg));
    const lookups = c.lookups.map(lc);
    const check = tests.length
      ? {
          expect: tests.map(([e]) => e).join("; "),
          holds: (n) => tests.every(([, test]) => test(n, lookups[0], lookups)),
        }
      : CHECKS[text];

    return [text, { ...c, ...check }];
  })
);

const [command, ...args] = process.argv.slice(2);

if (command === "compare") console.log(compare(load(args)));
else if (command === "report") console.log(report(load(args)));
else await measure(command, args[0], args[1]);

async function measure(databaseUrl, redisUrl, serverLog) {
  const { Client } = require("pg");
  const db = new Client({ connectionString: databaseUrl });

  await db.connect();
  // Nothing here writes; the transaction makes sure of it.
  await db.query("begin read only");
  const rows = async (sql, params) => (await db.query(sql, params)).rows;
  const scalar = async (sql, params) => Object.values((await rows(sql, params))[0])[0];
  // Every tally query answers `k, n`.
  const tally = async (sql) => Object.fromEntries((await rows(sql)).map((r) => [r.k, r.n]));
  const hasTable = async (name) =>
    (await scalar("select to_regclass($1) is not null", [name])) === true;

  const lineTable = await hasTable("recipe_ingredient_foods");
  const lineFoods = lineTable
    ? `select ri.id, ri.name, ri.joined::text as joined, f.position, a.ingredient_id, a.text as spelling
         from recipe_ingredients ri
         left join recipe_ingredient_foods f on f.recipe_ingredient_id = ri.id
         left join ingredient_aliases a on a.id = f.ingredient_alias_id`
    : `select ri.id, ri.name, null::text as joined, 0 as position, a.ingredient_id, a.text as spelling
         from recipe_ingredients ri left join ingredient_aliases a on a.id = ri.ingredient_alias_id`;
  // Ticket 25: an own food is listed once a recipe line names it; groceries alone leave it hidden.
  const lineSpellings = lineTable
    ? "select ingredient_alias_id from recipe_ingredient_foods"
    : "select ingredient_alias_id from recipe_ingredients where ingredient_alias_id is not null";
  const namedByLine = `exists (select 1 from ingredient_aliases a where a.ingredient_id = i.id and a.id in (${lineSpellings}))`;
  const namedBy = (table) =>
    `exists (select 1 from ${table} g where g.ingredient_id = i.id or g.ingredient_alias_id in (select id from ingredient_aliases where ingredient_id = i.id))`;
  const namedByGrocery = ["groceries", "recurring_groceries", "pantry_ingredients"]
    .map(namedBy)
    .join(" or ");
  const listed = `(i.off_id is not null or ${namedByLine})`;
  const words = JSON.parse(
    readFileSync(join(root, "packages/config/src/ingredient-words.default.json"), "utf8")
  );
  const joining = [
    ...new Set(
      Object.values(words).flatMap((w) => [...(w.together ?? []), ...(w.alternatives ?? [])])
    ),
  ];

  const counts = {
    ingredients: {
      all: await scalar("select count(*)::int from ingredients"),
      own: await scalar("select count(*)::int from ingredients where off_id is null"),
      seeded: await scalar("select count(*)::int from ingredients where off_id is not null"),
      flagged: await scalar("select count(*)::int from ingredients where flagged"),
      keptDistinct: await scalar("select count(*)::int from ingredients where kept_distinct"),
      withParent: await scalar("select count(*)::int from ingredients where parent_id is not null"),
      ownWithParent: await scalar(
        "select count(*)::int from ingredients where off_id is null and parent_id is not null"
      ),
    },
    flaggedBy: await tally(
      "select coalesce(flag_reason, '(none)') as k, count(*)::int as n from ingredients where flagged group by 1 order by 2 desc"
    ),
    spellings: {
      all: await scalar("select count(*)::int from ingredient_aliases"),
      own: await scalar("select count(*)::int from ingredient_aliases where not seeded"),
    },
    lines:
      await tally(`with l as (select id, name, max(joined) as joined, count(ingredient_id) as foods from (${lineFoods}) x group by id, name)
          select case when name like '#%' then 'heading'
                      when name ~ ':\\s*$' and foods > 0 then 'colon line, with a food'
                      when foods = 0 then 'no food'
                      when foods = 1 then 'one food'
                      else 'several, ' || coalesce(joined, 'unjoined') end as k, count(*)::int as n
          from l group by 1 order by 1`),
    noFood: {
      groceries: await scalar(
        "select count(*)::int from groceries where ingredient_alias_id is null"
      ),
      recurringGroceries: await scalar(
        "select count(*)::int from recurring_groceries where ingredient_alias_id is null"
      ),
      pantryIngredients: await scalar(
        "select count(*)::int from pantry_ingredients where ingredient_alias_id is null"
      ),
    },
    rows: {
      lines: await scalar("select count(*)::int from recipe_ingredients"),
      groceries: await scalar("select count(*)::int from groceries"),
      recurringGroceries: await scalar("select count(*)::int from recurring_groceries"),
      pantryIngredients: await scalar("select count(*)::int from pantry_ingredients"),
    },
    hidden: {
      "grocery foods": await scalar(
        `select count(*)::int from ingredients i where not ${listed} and (${namedByGrocery})`
      ),
      "foods nothing names": await scalar(
        `select count(*)::int from ingredients i where not ${listed} and not (${namedByGrocery})`
      ),
    },
    // By this release's joining words in every language, so all runs are read alike.
    joinedOwnFoods: await scalar(
      "select count(*)::int from ingredients where off_id is null and lower(name) ~ $1",
      [`\\s(${joining.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\s`]
    ),
  };
  const names = {
    flagged: await rows(
      "select name, coalesce(flag_reason, '(none)') as reason from ingredients where flagged order by flag_reason, lower(name)"
    ),
    aiChanges: [],
  };

  const pile = await hasTable("ingredient_junk_pile");

  if (await hasTable("ingredient_ai_changes")) {
    counts.aiChanges =
      await tally(`select case when kind = 'spelling' then 'spelling ' || case when target_id is null then 'removed' else 'moved' end else kind end
        || ', ' || case when sure then 'sure' else 'unsure' end as k, count(*)::int as n
      from ingredient_ai_changes group by 1 order by 1`);
    // Each change as the food it was and what it became (merge: the food's name went into the target).
    names.aiChanges = await rows(`select c.kind, c.sure,
        case when c.undone_at is not null then 'undone' when c.kept_at is not null then 'kept' else 'open' end as state,
        case c.kind when 'merge' then c.undo->>'name' when 'not-a-food' then c.undo->'food'->>'name'
                    when 'plain-name' then c.undo->>'formerName' else i.name end as food,
        ${pile ? "c.kind = 'spelling' and exists (select 1 from ingredient_junk_pile j where j.ai_change_id = c.id)" : "false"} as junk,
        case c.kind when 'merge' then 'merged into ' || i.name when 'not-a-food' then 'deleted'
                    when 'plain-name' then 'renamed ' || (c.undo->>'name')
                    when 'parent' then coalesce('under ' || t.name, 'no parent') || coalesce(' (was ' || fp.name || ')', '')
                    when 'spelling' then coalesce('moved "' || (c.undo->'spelling'->>'text') || '" to ' || t.name,
                                                  'removed "' || (c.undo->'spelling'->>'text') || '"')
                    else c.kind end as became
      from ingredient_ai_changes c left join ingredients i on i.id = c.ingredient_id
      left join ingredients t on t.id = c.target_id
      left join ingredients fp on fp.id = (c.undo->>'formerParentId')::uuid
      order by c.kind, c.sure desc, 4, 6`);
  }
  if (await hasTable("ingredient_suggestions")) {
    counts.suggestions = await tally(
      "select kind as k, count(*)::int as n from ingredient_suggestions group by 1 order by 1"
    );
  }

  const cases = {};

  for (const [text, { lookups }] of Object.entries(CASES)) {
    const exact = lookups.map(lc);
    const lines = await rows(
      `select x.id, x.name, max(x.joined) as joined, array_remove(array_agg(distinct x.spelling), null) as spellings,
              array_remove(array_agg(i.name order by x.position), null) as foods
         from (${lineFoods}) x left join ingredients i on i.id = x.ingredient_id
        where lower(x.name) like any($1) group by x.id, x.name order by x.name`,
      [exact.map((t) => `%${t.replace(/[\\%_]/g, "\\$&")}%`)]
    );
    // The case's own texts, and the spellings its lines point at (a cleanup may have renamed one).
    const spellings = await rows(
      `select a.text, a.seeded, a.ingredient_id, i.name as food from ingredient_aliases a join ingredients i on i.id = a.ingredient_id
        where lower(a.text) = any($1) or a.text = any($2) order by a.text limit 12`,
      [exact, lines.flatMap((l) => l.spellings)]
    );
    const foods = await rows(
      `select distinct i.name, i.off_id is not null as seeded, i.flagged, i.flag_reason as reason, i.kept_distinct as distinct,
              not ${listed} as hidden, p.name as parent
        from ingredients i left join ingredients p on p.id = i.parent_id
        where lower(i.name) = any($1) or i.id = any($2::uuid[]) order by i.name limit 12`,
      [exact, spellings.map((sp) => sp.ingredient_id)]
    );

    cases[text] = {
      spellings: spellings.map(({ text, seeded, food }) => ({ text, seeded, food })),
      foods,
      lines: lines.map((l) => ({ text: l.name, foods: l.foods, joined: l.joined })),
    };
  }

  await db.query("rollback");
  await db.end();

  const ai = redisUrl ? await aiUse(redisUrl) : null;
  const start = serverLog ? startFrom(readFileSync(serverLog, "utf8")) : null;

  console.log(JSON.stringify({ counts, names, ai, start, cases }, null, 2));
}

/** Requests, tokens and time per queue, from every job's progress (the job monitor's Models row). */
async function aiUse(redisUrl) {
  const ioredis = createRequire(join(root, "packages/queue/package.json"))("ioredis");
  const Redis = ioredis.default ?? ioredis.Redis ?? ioredis;
  const redis = new Redis(redisUrl);
  const byQueue = {};
  let cursor = "0";

  do {
    const [next, keys] = await redis.scan(cursor, "MATCH", "bull:*", "COUNT", 1000);

    cursor = next;
    for (const key of keys) {
      const parts = key.split(":");

      if (parts.length !== 3 || (await redis.type(key)) !== "hash") continue;
      const [progress, processedOn, finishedOn] = await redis.hmget(
        key,
        "progress",
        "processedOn",
        "finishedOn"
      );

      if (!progress) continue;
      const uses = [];
      const walk = (value) => {
        if (Array.isArray(value)) value.forEach(walk);
        else if (value && typeof value === "object") {
          if (Array.isArray(value.models)) uses.push(...value.models);
          else Object.values(value).forEach(walk);
        }
      };

      walk(JSON.parse(progress));
      if (uses.length === 0) continue;
      const q = (byQueue[parts[1]] ??= {
        jobs: 0,
        requests: 0,
        failed: 0,
        tokens: 0,
        models: {},
        tokensByModel: {},
        ms: 0,
        first: Infinity,
        last: 0,
      });

      q.jobs += 1;
      q.ms += Number(finishedOn ?? processedOn) - Number(processedOn);
      q.first = Math.min(q.first, Number(processedOn));
      q.last = Math.max(q.last, Number(finishedOn ?? processedOn));
      for (const use of uses) {
        q.requests += 1;
        if (use.outcome === "failed") q.failed += 1;
        q.tokens += use.tokens ?? 0;
        const model = `${use.provider} · ${use.model}`;

        q.models[model] = (q.models[model] ?? 0) + 1;
        q.tokensByModel[model] = (q.tokensByModel[model] ?? 0) + (use.tokens ?? 0);
      }
    }
  } while (cursor !== "0");
  await redis.quit();

  return byQueue;
}

/** The boot's steps from a pino-pretty server log: each step's logged outcome and its time. */
function startFrom(log) {
  // eslint-disable-next-line no-control-regex
  const lines = log.replace(/\x1b\[[0-9;]*m/g, "").split("\n");
  const at = (line) => {
    const m = /^\[(\d+):(\d+):(\d+)\.(\d+)\]/.exec(line);

    return m && ((+m[1] * 60 + +m[2]) * 60 + +m[3]) * 1000 + +m[4];
  };
  const steps = [];
  let first = null;
  let since = null;
  let ready = null;

  for (let i = 0; i < lines.length; i++) {
    const time = at(lines[i]);

    if (time === null) continue;
    const message = lines[i].replace(/^\[[^\]]*\]\s+\w+\s+(\([^)]*\))?:?\s*/, "").trim();

    // From the config load, after the embedded parser's own start.
    if (message.startsWith("Server configuration loaded")) first ??= time;

    if (/^-{20,}$/.test(message)) since = time;
    if (ready === null && message.startsWith("HTTP:")) ready = time - first;
    const fields = {};

    for (let j = i + 1; j < lines.length && /^\s{4}\w+: /.test(lines[j]); j++) {
      const [, key, value] = /^\s{4}(\w+): (.*)$/.exec(lines[j]);

      fields[key] = /^\d+$/.test(value) ? Number(value) : value.replace(/^"|"$/g, "");
    }
    if (ready === null && fields.module === "ingredient-seed") {
      const { module: _module, ...outcome } = fields;

      steps.push({ step: message, ms: since === null ? null : time - since, ...outcome });
    }
  }

  return { readyMs: ready, steps };
}

function load(args) {
  return args.map((arg) => {
    const [label, file] = arg.split("=");

    return { label, ...JSON.parse(readFileSync(file, "utf8")) };
  });
}

/** The tables of counts, every run a column. */
function tables(runs) {
  const out = [];
  const table = (title, pick) => {
    const keys = [...new Set(runs.flatMap((r) => Object.keys(pick(r) ?? {})))];

    if (keys.length > 0)
      out.push({ title, keys, values: keys.map((k) => runs.map((r) => pick(r)?.[k] ?? "–")) });
  };

  table("Ingredients", (r) => r.counts.ingredients);
  table("Flagged, by reason", (r) => r.counts.flaggedBy);
  table("Spellings", (r) => r.counts.spellings);
  table("Joined names still a food of their own", (r) => ({
    "own foods": r.counts.joinedOwnFoods,
  }));
  table("Recipe lines", (r) => r.counts.lines);
  table("Rows that point at no food", (r) => r.counts.noFood);
  table("Rows", (r) => r.counts.rows);
  table("Hidden (ticket 25)", (r) => r.counts.hidden);
  table("0.25.1 suggestions left", (r) => r.counts.suggestions);
  table("AI Changes", (r) => r.counts.aiChanges);
  table("The first start", (r) =>
    r.start
      ? Object.fromEntries([
          ["ready, ms", r.start.readyMs],
          ...r.start.steps.map((s) => [`${s.step}, ms`, s.ms]),
          ...r.start.steps.flatMap((s) =>
            Object.entries(s)
              .filter(
                ([k, v]) =>
                  k !== "ms" && k !== "step" && !k.endsWith("Version") && typeof v === "number"
              )
              .map(([k, v]) => [`${s.step}: ${k}`, v])
          ),
        ])
      : null
  );
  for (const queue of [...new Set(runs.flatMap((r) => Object.keys(r.ai ?? {})))]) {
    table(`AI use, ${queue} queue`, (r) => {
      const q = r.ai?.[queue];

      return (
        q && {
          jobs: q.jobs,
          requests: q.requests,
          failed: q.failed,
          tokens: q.tokens,
          "job time, s": q.ms === undefined ? "–" : Math.round(q.ms / 1000),
          "first start to last end, s":
            q.last === undefined ? "–" : Math.round((q.last - q.first) / 1000),
          ...Object.fromEntries(
            Object.entries(q.models).map(([m, n]) => [
              `${m}, requests / tokens`,
              `${n} / ${q.tokensByModel?.[m] ?? "–"}`,
            ])
          ),
        }
      );
    });
  }

  return out;
}

function compare(runs) {
  return tables(runs)
    .flatMap(({ title, keys, values }) => [
      `**${title}**`,
      "",
      `| | ${runs.map((r) => r.label).join(" | ")} |`,
      `|---|${runs.map(() => "---:").join("|")}|`,
      ...keys.map((k, i) => `| ${k} | ${values[i].join(" | ")} |`),
      "",
    ])
    .join("\n");
}

function report(runs) {
  const esc = (v) =>
    String(v ?? "").replace(
      /[&<>"]/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]
    );
  const list = (items) =>
    items.length
      ? `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`
      : "<p class=none>none</p>";
  const head = `<tr><th></th>${runs.map((r) => `<th>${esc(r.label)}</th>`).join("")}</tr>`;
  const row = (label, cells, raw = false) =>
    `<tr><th>${esc(label)}</th>${cells.map((c) => `<td>${raw ? c : esc(c)}</td>`).join("")}</tr>`;
  const section = (title, body) => `<h2>${esc(title)}</h2><table>${head}${body}</table>`;
  const food = (f) =>
    `${f.name}${f.seeded ? " [seed]" : ""}${f.flagged ? ` [flag: ${f.reason}]` : ""}${f.distinct ? " [distinct]" : ""}${f.hidden ? " [hidden]" : ""}${f.parent ? ` under ${f.parent}` : ""}`;
  const lines = (n) =>
    n.lines.map(
      (l) => `${l.text} → ${l.foods.join(" + ") || "(no food)"}${l.joined ? ` (${l.joined})` : ""}`
    );

  const counts = tables(runs)
    .map(({ title, keys, values }) =>
      section(title, keys.map((k, i) => row(k, values[i])).join(""))
    )
    .join("");
  const flagged = section(
    "Flagged foods",
    row(
      "names",
      runs.map((r) => list((r.names?.flagged ?? []).map((f) => `${f.name} (${f.reason})`))),
      true
    )
  );
  const changes = section(
    "AI Changes, each",
    row(
      "food → became",
      runs.map((r) =>
        list(
          (r.names?.aiChanges ?? []).map(
            (c) =>
              `${c.kind}, ${c.sure ? "sure" : "unsure"}, ${c.state}: ${c.food} → ${c.became}${c.junk ? " (not a food)" : ""}`
          )
        )
      ),
      true
    )
  );
  const cases = Object.entries(CASES)
    .map(([text, c]) => {
      const verdict = (r) => {
        if (!c.holds) return "";
        const n = r.cases?.[text];

        return n ? (c.holds(n, r.counts) ? "holds" : "does not hold") : "not measured";
      };
      const pick = (f) =>
        runs.map((r) => (r.cases?.[text] ? f(r.cases[text]) : "<p class=none>not measured</p>"));

      return `<h3>${esc(text)} <small>ticket ${esc(c.ticket)}${c.expect ? `: ${esc(c.expect)}` : ""}</small></h3><table>${head}${
        c.holds
          ? row(
              "check",
              runs.map((r) => `<b class="${verdict(r).replace(/ /g, "-")}">${verdict(r)}</b>`),
              true
            )
          : ""
      }${row(
        "spellings",
        pick((n) =>
          list(n.spellings.map((s) => `${s.text}${s.seeded ? " [seed]" : ""} → ${s.food}`))
        ),
        true
      )}${row(
        "foods",
        pick((n) => list(n.foods.map(food))),
        true
      )}${row(
        "lines",
        pick((n) => `<p>${n.lines.length}</p>${list(lines(n))}`),
        true
      )}</table>`;
    })
    .join("");

  return `<!doctype html><html lang=en><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
<title>Ingredient cleanup measure</title>
<style>
:root{color-scheme:light dark;--bg:#fff;--fg:#1d1d1f;--muted:#6e6e73;--line:#ddd;--ok:#1a7f37;--bad:#c62828}
@media (prefers-color-scheme:dark){:root{--bg:#161618;--fg:#ececf0;--muted:#9a9aa2;--line:#333;--ok:#4cc26a;--bad:#ff6b6b}}
body{background:var(--bg);color:var(--fg);font:14px/1.45 system-ui,sans-serif;margin:0 auto;padding:16px;max-width:1400px}
table{border-collapse:collapse;width:100%;margin:0 0 24px;table-layout:fixed}
th,td{border-bottom:1px solid var(--line);padding:4px 8px;text-align:left;vertical-align:top;overflow-wrap:anywhere}
tr:first-child th{border-bottom:2px solid var(--fg)}
td{font-variant-numeric:tabular-nums}
th:first-child{width:22%}
ul{margin:0;padding-left:18px}
.none,small{color:var(--muted)}
.holds{color:var(--ok)}.does-not-hold{color:var(--bad)}
</style>
<h1>Ingredient cleanup measure</h1>
<p class=none>Production text. Kept outside the repository; never publish.</p>
<table>${head}${row(
    "run",
    runs.map((r) => r.note ?? "")
  )}</table>${counts}${flagged}${changes}<h2>Named cases</h2>${cases}</html>`;
}
