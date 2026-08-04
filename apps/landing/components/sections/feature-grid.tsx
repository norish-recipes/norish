import type { ComponentType, SVGProps } from "react";
import {
  BoltIcon,
  CalendarDaysIcon,
  ChartPieIcon,
  CpuChipIcon,
  FingerPrintIcon,
  FireIcon,
  LanguageIcon,
  ShoppingCartIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";

import { Reveal } from "../motion/reveal";
import { Stagger, StaggerItem } from "../motion/stagger";

type Feature = {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  description: string;
};

const features: Feature[] = [
  {
    icon: SparklesIcon,
    title: "Import from anywhere",
    description:
      "Paste a link from any website, blog or app and Norish pulls the recipe in clean and structured, no retyping.",
  },
  {
    icon: ChartPieIcon,
    title: "Nutrition & allergy insight",
    description:
      "Automatic calories, protein, carbs and fat estimations. Allergy detection that flags ingredients before they reach the table.*",
  },
  {
    icon: CalendarDaysIcon,
    title: "Plan together",
    description:
      "Drop recipes onto a meal calendar your household shares, and bring the plan into your own calendar app over CalDAV.",
  },
  {
    icon: ShoppingCartIcon,
    title: "Shop together",
    description:
      "Build a shopping list your household shares. Split the aisles between you, and as one person ticks off an item it updates for whoever else is shopping, so nothing gets bought twice.",
  },
  {
    icon: BoltIcon,
    title: "Real-time, always",
    description:
      "Edit a recipe, tick off an item, plan a dinner, and the people you share with see it instantly on every device, no refresh required.",
  },
  {
    icon: FireIcon,
    title: "Cooking mode",
    description:
      "A focused, step-by-step view with timers and scaled quantities, and a screen that stays awake while you cook.",
  },
  {
    icon: CpuChipIcon,
    title: "Bring your own AI",
    description:
      "Connect a cloud provider like OpenAI or Anthropic, or run a local model with Ollama or LM Studio. It powers photo, screenshot and video imports, nutrition estimates and allergy detection, and only runs when you turn it on.",
  },
  {
    icon: FingerPrintIcon,
    title: "Auth on your terms",
    description:
      "Sign in with any OIDC provider, such as Authentik, Keycloak or Pocket ID, with GitHub or Google, or with plain email and password. Map OIDC groups straight to roles and households.",
  },
  {
    icon: LanguageIcon,
    title: "In your language",
    description:
      "Use Norish in 10 languages, translated by the community. Set a default for your instance, or let everyone pick the language they read best.",
  },
];

export function FeatureGrid() {
  return (
    <section className="scroll-mt-24 px-4 py-20 sm:py-28" id="features">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-accent text-sm font-semibold tracking-wide uppercase">Features</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Everything your kitchen needs
          </h2>
          <p className="text-muted mt-4 text-pretty">
            A calm, beautiful home for recipes, groceries and planning, shared with the people you
            cook for.
          </p>
        </Reveal>

        <Stagger className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, description }) => (
            <StaggerItem key={title} className="h-full">
              <article className="group border-border bg-surface hover:border-accent/40 relative h-full overflow-hidden rounded-2xl border p-6 transition-all duration-300 hover:-translate-y-1">
                <div className="bg-accent/10 text-accent mb-5 grid size-11 place-items-center rounded-xl">
                  <Icon className="size-5.5" />
                </div>
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="text-muted mt-2 text-sm leading-relaxed text-pretty">{description}</p>
              </article>
            </StaggerItem>
          ))}
        </Stagger>

        <p className="text-muted/80 mt-8 text-center text-xs">
          * Requires an AI provider, which you bring and configure yourself.
        </p>
      </div>
    </section>
  );
}
