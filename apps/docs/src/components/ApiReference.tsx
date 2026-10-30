import type { TOCItem } from "@docusaurus/mdx-loader";
import type { ReactNode } from "react";
import React, { Fragment } from "react";
import { ChevronRightIcon } from "@heroicons/react/16/solid";
import { Chip, Disclosure, Tabs } from "@heroui/react";
import CodeBlock from "@theme/CodeBlock";
import Heading from "@theme/Heading";
import clsx from "clsx";

/*
 * The public API, read from the OpenAPI document the trpc package publishes
 * (docs/reference/openapi.json) and drawn with the docs' own components. Only
 * the parts of OpenAPI that document uses are understood.
 */

type Schema = {
  $ref?: string;
  type?: string | string[];
  format?: string;
  title?: string;
  description?: string;
  properties?: Record<string, Schema>;
  required?: string[];
  items?: Schema;
  anyOf?: Schema[];
  enum?: unknown[];
  const?: unknown;
  default?: unknown;
  example?: unknown;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  minLength?: number;
  maxLength?: number;
  maxItems?: number;
  additionalProperties?: boolean | Schema;
};

type Parameter = {
  in: string;
  name: string;
  required?: boolean;
  schema: Schema;
  description?: string;
};

type Content = { content?: Record<string, { schema: Schema }> };

type Operation = {
  operationId: string;
  summary: string;
  description?: string;
  tags?: string[];
  security?: Record<string, unknown>[];
  parameters?: Parameter[];
  requestBody?: Content & { required?: boolean };
  responses: Record<string, Content & { description: string }>;
};

type Spec = {
  info: { title: string; description?: string };
  servers?: { url: string; variables?: Record<string, { default: string }> }[];
  tags?: { name: string }[];
  paths: Record<string, Record<string, Operation>>;
  components?: { schemas?: Record<string, Schema> };
};

type Endpoint = { method: string; path: string; operation: Operation };

function endpointsByTag(spec: Spec) {
  const groups = new Map<string, Endpoint[]>((spec.tags ?? []).map((tag) => [tag.name, []]));

  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      const tag = operation.tags?.[0] ?? "Other";

      groups.set(tag, [...(groups.get(tag) ?? []), { method, path, operation }]);
    }
  }

  return [...groups].filter(([, endpoints]) => endpoints.length > 0);
}

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** The page's "On this page": a heading per tag, a line per endpoint. */
export function apiToc(spec: Spec): TOCItem[] {
  return endpointsByTag(spec).flatMap(([tag, endpoints]) => [
    { value: tag, id: slug(tag), level: 2 },
    ...endpoints.map(({ operation }) => ({
      value: operation.summary,
      id: slug(operation.operationId),
      level: 3,
    })),
  ]);
}

export default function ApiReference({ spec }: { spec: Spec }) {
  const resolve: Resolve = (schema) => {
    if (schema.$ref) {
      return resolve(spec.components?.schemas?.[schema.$ref.split("/").pop() ?? ""] ?? {});
    }

    const { type, ...rest } = schema;

    // zod writes a nullable primitive as `type: ["string", "null"]`; read it as the anyOf it means.
    return Array.isArray(type)
      ? { ...rest, anyOf: type.map((option) => ({ type: option })) }
      : { ...rest, type };
  };
  const server = spec.servers?.[0];
  const baseUrl = (server?.url ?? "").replace(
    /\{(\w+)\}/g,
    (_, name: string) => server?.variables?.[name]?.default ?? name
  );

  return (
    <>
      <dl className="border-border bg-background/60 mb-4 grid gap-4 rounded-2xl border p-5 sm:grid-cols-2">
        <div>
          <dt className="text-muted text-sm">Base URL</dt>
          <dd className="mt-1 font-mono text-sm break-all">{baseUrl}</dd>
        </div>
        <div>
          <dt className="text-muted text-sm">Authentication</dt>
          <dd className="mt-1 text-sm">
            <code className="whitespace-nowrap">x-api-key: &lt;key&gt;</code> or{" "}
            <code className="whitespace-nowrap">Authorization: Bearer &lt;key&gt;</code>
          </dd>
        </div>
      </dl>

      {endpointsByTag(spec).map(([tag, endpoints]) => (
        <section key={tag}>
          <Heading as="h2" id={slug(tag)}>
            {tag}
          </Heading>
          {endpoints.map((endpoint) => (
            <EndpointSection
              key={`${endpoint.method} ${endpoint.path}`}
              baseUrl={baseUrl}
              endpoint={endpoint}
              resolve={resolve}
            />
          ))}
        </section>
      ))}
    </>
  );
}

// A resolved schema has no $ref left to follow and a single `type`.
type Resolve = (schema: Schema) => Schema & { type?: string };

function EndpointSection({
  endpoint: { method, path, operation },
  baseUrl,
  resolve,
}: {
  endpoint: Endpoint;
  baseUrl: string;
  resolve: Resolve;
}) {
  const parameters = operation.parameters ?? [];
  const body = operation.requestBody?.content?.["application/json"]?.schema;
  const responses = Object.entries(operation.responses);

  return (
    <article className="border-separator mt-8 border-t pt-8 first-of-type:mt-6 first-of-type:border-t-0 first-of-type:pt-0">
      <Heading as="h3" className="mt-0" id={slug(operation.operationId)}>
        {operation.summary}
      </Heading>
      <p className="mb-4 flex flex-wrap items-center gap-2">
        <MethodChip method={method} />
        <code className="bg-transparent px-0 text-[0.9375rem]">{path}</code>
      </p>
      {operation.description && <p>{inlineCode(operation.description)}</p>}

      {parameters.length > 0 && (
        <Block title="Parameters">
          <FieldList>
            {parameters.map((parameter) => (
              <Field
                key={parameter.name}
                name={parameter.name}
                note={parameter.in === "path" ? "path" : "query"}
                required={parameter.required}
                resolve={resolve}
                schema={{ ...parameter.schema, description: parameter.description }}
              />
            ))}
          </FieldList>
        </Block>
      )}

      {body && (
        <Block title="Request body">
          <SchemaFields showRequired resolve={resolve} schema={resolve(body)} />
        </Block>
      )}

      <Block title="Responses">
        <Tabs className="gap-3">
          <Tabs.ListContainer className="w-fit">
            <Tabs.List aria-label={`${operation.summary} responses`}>
              {responses.map(([status]) => (
                <Tabs.Tab key={status} className="gap-1.5 px-3 font-mono text-xs" id={status}>
                  <span
                    className={clsx(
                      "size-1.5 rounded-full",
                      status.startsWith("2") ? "bg-success" : "bg-danger"
                    )}
                  />
                  {status}
                  <Tabs.Indicator />
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs.ListContainer>
          {responses.map(([status, response]) => {
            const schema = response.content?.["application/json"]?.schema;
            const fields = schema && resolve(schema);

            return (
              <Tabs.Panel key={status} className="p-0" id={status}>
                <p className="text-muted mb-3 text-sm">{inlineCode(response.description)}</p>
                {schema && (
                  <CodeBlock className="[&_pre]:max-h-96" language="json" title="Response">
                    {JSON.stringify(sample(schema, resolve), null, 2)}
                  </CodeBlock>
                )}
                {fields?.properties && (
                  <MoreFields count={Object.keys(fields.properties).length}>
                    <SchemaFields resolve={resolve} schema={fields} />
                  </MoreFields>
                )}
              </Tabs.Panel>
            );
          })}
        </Tabs>
      </Block>

      <Block title="Example request">
        <CodeBlock language="bash">
          {curl(method, baseUrl, path, parameters, body, resolve)}
        </CodeBlock>
      </Block>
    </article>
  );
}

// GET has no HeroUI colour of its own; it borrows the app's blue.
const methodColor: Record<string, "success" | "warning" | "danger"> = {
  post: "success",
  patch: "warning",
  put: "warning",
  delete: "danger",
};

function MethodChip({ method }: { method: string }) {
  const color = methodColor[method];

  return (
    <Chip
      className={clsx(
        "font-mono text-[0.6875rem] font-semibold tracking-wide",
        !color && "bg-nutrition-carbs-soft text-nutrition-carbs"
      )}
      color={color}
      size="sm"
      variant="soft"
    >
      {method.toUpperCase()}
    </Chip>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-6">
      <p className="mb-2.5 text-sm font-semibold">{title}</p>
      {children}
    </div>
  );
}

function FieldList({ children }: { children: ReactNode }) {
  return (
    <ul className="border-border divide-separator m-0 list-none divide-y rounded-2xl border p-0">
      {children}
    </ul>
  );
}

/** A schema's fields. `required` is only marked on what the caller sends. */
function SchemaFields({
  schema,
  resolve,
  showRequired,
}: {
  schema: Schema;
  resolve: Resolve;
  showRequired?: boolean;
}) {
  const properties = Object.entries(schema.properties ?? {});

  if (properties.length === 0) {
    return <p className="text-muted text-sm">{typeLabel(schema, resolve)}</p>;
  }

  return (
    <FieldList>
      {properties.map(([name, property]) => (
        <Field
          key={name}
          name={name}
          required={showRequired && schema.required?.includes(name)}
          resolve={resolve}
          schema={property}
          showRequired={showRequired}
        />
      ))}
    </FieldList>
  );
}

function Field({
  name,
  schema: raw,
  required,
  note,
  resolve,
  showRequired,
}: {
  name: string;
  schema: Schema;
  required?: boolean;
  note?: string;
  resolve: Resolve;
  showRequired?: boolean;
}) {
  const schema = resolve(raw);
  const nested = objectInside(schema, resolve);
  const values = enumOf(schema, resolve);
  const facts = factsOf(schema);

  return (
    <li className="m-0 px-4 py-3">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <code className="bg-transparent px-0 text-[0.8125rem] font-semibold">{name}</code>
        <span className="text-muted font-mono text-xs">{typeLabel(schema, resolve)}</span>
        {note && <span className="text-muted text-xs">{note}</span>}
        {required && <span className="text-danger text-xs font-medium">required</span>}
      </div>
      {schema.description && (
        <p className="text-muted mt-1 mb-0 text-sm leading-relaxed">
          {inlineCode(schema.description)}
        </p>
      )}
      {values && (
        <div className="mt-2 flex flex-wrap gap-1">
          {values.map((value) => (
            <Chip key={String(value)} className="font-mono text-[0.6875rem]" size="sm">
              {String(value)}
            </Chip>
          ))}
        </div>
      )}
      {facts.length > 0 && (
        <p className="text-muted mt-1.5 mb-0 text-xs">
          {facts.map((fact, index) => (
            <Fragment key={fact}>
              {index > 0 && " · "}
              {fact}
            </Fragment>
          ))}
        </p>
      )}
      {nested?.properties && (
        <MoreFields count={Object.keys(nested.properties).length}>
          <SchemaFields resolve={resolve} schema={nested} showRequired={showRequired} />
        </MoreFields>
      )}
    </li>
  );
}

/** Fields folded away until asked for: nested objects, and a response's whole shape. */
function MoreFields({ count, children }: { count: number; children: ReactNode }) {
  return (
    <Disclosure className="mt-2">
      <Disclosure.Trigger className="group text-muted hover:text-foreground flex items-center gap-1 text-xs font-medium">
        <ChevronRightIcon className="size-3.5 transition-transform group-aria-expanded:rotate-90" />
        {count} fields
      </Disclosure.Trigger>
      <Disclosure.Content>
        <div className="pt-2">{children}</div>
      </Disclosure.Content>
    </Disclosure>
  );
}

/** "string (uuid)", "integer[]", "string | null". */
function typeLabel(schema: Schema, resolve: Resolve): string {
  const s = resolve(schema);

  if (s.anyOf) return s.anyOf.map((option) => typeLabel(option, resolve)).join(" | ");
  if (s.const !== undefined) return JSON.stringify(s.const);
  if (s.type === "array") return `${s.items ? typeLabel(s.items, resolve) : "unknown"}[]`;
  if (s.type === "object" && !s.properties && s.additionalProperties) return "map";

  return s.format ? `${s.type} (${s.format})` : (s.type ?? "any");
}

/** The object a field holds, through `| null` and arrays, when it has fields of its own. */
function objectInside(schema: Schema, resolve: Resolve): Schema | undefined {
  const s = resolve(schema);

  if (s.properties) return s;
  if (s.items) return objectInside(s.items, resolve);

  return s.anyOf?.map((option) => objectInside(option, resolve)).find(Boolean);
}

function enumOf(schema: Schema, resolve: Resolve): unknown[] | undefined {
  const s = resolve(schema);

  if (s.enum) return s.enum;
  if (s.items) return enumOf(s.items, resolve);

  return s.anyOf?.map((option) => enumOf(option, resolve)).find(Boolean);
}

// Bounds that only restate the column type (int32, JS safe integers) say nothing.
const typeBounds = new Set([-2147483648, 2147483647, 9007199254740991, -9007199254740991]);

const isBound = (value?: number): value is number => value !== undefined && !typeBounds.has(value);

function factsOf(schema: Schema): string[] {
  const facts: string[] = [];

  if (schema.default !== undefined && !(Array.isArray(schema.default) && !schema.default.length)) {
    facts.push(`Default ${JSON.stringify(schema.default)}`);
  }
  if (isBound(schema.minimum)) facts.push(`Min ${schema.minimum}`);
  if (isBound(schema.exclusiveMinimum)) facts.push(`Above ${schema.exclusiveMinimum}`);
  if (isBound(schema.maximum)) facts.push(`Max ${schema.maximum}`);
  if (schema.minLength) facts.push(`At least ${schema.minLength} characters`);
  if (schema.maxLength) facts.push(`At most ${schema.maxLength} characters`);
  if (schema.maxItems) facts.push(`At most ${schema.maxItems} items`);

  return facts;
}

/** A plausible value for a schema, for the example request and responses. */
function sample(schema: Schema, resolve: Resolve, onlyRequired = false, depth = 0): unknown {
  const s = resolve(schema);

  if (depth > 6) return null;
  if (s.example !== undefined) return s.example;
  if (s.const !== undefined) return s.const;
  if (s.default !== undefined && !(Array.isArray(s.default) && !s.default.length)) return s.default;
  if (s.enum) return s.enum[0];
  if (s.anyOf) {
    const option = s.anyOf.find((candidate) => resolve(candidate).type !== "null") ?? s.anyOf[0];

    return sample(option, resolve, onlyRequired, depth);
  }

  switch (s.type) {
    case "object": {
      const entries = Object.entries(s.properties ?? {}).filter(
        ([name]) => !onlyRequired || s.required?.includes(name)
      );

      return Object.fromEntries(
        entries.map(([name, property]) => [
          name,
          sample(property, resolve, onlyRequired, depth + 1),
        ])
      );
    }
    case "array":
      return s.items ? [sample(s.items, resolve, onlyRequired, depth + 1)] : [];
    case "integer":
    case "number":
      if (isBound(s.minimum)) return s.minimum;
      if (isBound(s.exclusiveMinimum)) return s.exclusiveMinimum + 1;

      return 1;
    case "boolean":
      return true;
    case "null":
      return null;
    case "string":
      return stringSample(s.format);
    default:
      return null;
  }
}

function stringSample(format?: string) {
  if (format === "uuid") return "6f1c2a7e-8b5d-4c1e-9f2a-6d7b8c9e0a1b";
  if (format === "date-time") return "2026-01-01T12:00:00.000Z";
  if (format === "date") return "2026-01-01";
  if (format === "uri" || format === "url") return "https://example.com";

  return "string";
}

function curl(
  method: string,
  baseUrl: string,
  path: string,
  parameters: Parameter[],
  body: Schema | undefined,
  resolve: Resolve
) {
  const query = parameters
    .filter((parameter) => parameter.in === "query" && parameter.required)
    .map((parameter) => `${parameter.name}=${String(sample(parameter.schema, resolve))}`)
    .join("&");
  const url = `${baseUrl}${path}${query ? `?${query}` : ""}`;
  const lines = [
    `curl${method === "get" ? "" : ` -X ${method.toUpperCase()}`} "${url}"`,
    `  -H "x-api-key: $NORISH_API_KEY"`,
  ];

  if (body) {
    const json = JSON.stringify(sample(body, resolve, true), null, 2);

    lines.push(`  -H "Content-Type: application/json"`, `  -d '${json}'`);
  }

  return lines.join(" \\\n");
}

/** Descriptions mark identifiers with backticks; nothing else. */
function inlineCode(text: string) {
  return text
    .split(/`([^`]+)`/)
    .map((part, index) => (index % 2 ? <code key={index}>{part}</code> : part));
}
