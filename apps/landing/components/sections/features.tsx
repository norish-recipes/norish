import { PlusIcon } from "@heroicons/react/24/outline";

import { Reveal } from "../reveal";

type Feature = {
  title: string;
  body: string;
  /** Marks a capability that only runs once you supply an AI provider. */
  ai?: true;
  /** Marks something that is on the way rather than shipped. */
  pending?: true;
};

type Group = {
  name: string;
  /** A full class pair, written out so Tailwind's scanner can see it. */
  tint: string;
  features: Feature[];
};

const groups: Group[] = [
  {
    name: "Importing recipes.",
    tint: "bg-tint-site",
    features: [
      {
        title: "From a link",
        body: "Websites, blogs and recipe apps. Norish turns the structured data into a clean recipe, no clutter.",
      },
      {
        title: "From a video",
        body: "YouTube, Instagram and Facebook and more. When no audio is available it looks at the discription.",
        ai: true,
      },
      {
        title: "From a photo",
        body: "A screenshot, a page of a cookbook, a card in someone's handwriting. Up to ten photos are combined into a single recipe.",
        ai: true,
      },
      {
        title: "From pasted text",
        body: "Free text or raw JSON-LD. Useful when a site will not cooperate and you can still copy what is on it.",
      },
      {
        title: "Filled in afterwards",
        body: "Tags, meal categories, cuisines, nutrition, allergens and provenance are worked out in the background once a recipe lands.",
        ai: true,
      },
    ],
  },
  {
    name: "Cooking and planning",
    tint: "bg-tint-photo",
    features: [
      {
        title: "Cooking mode",
        body: "Step-by-step and easy on the eye, with timers where the step needs them, quantities already scaled, and a screen that stays awake.",
      },
      {
        title: "Linked ingredients in steps",
        body: "A step can carry the ingredient lines it uses and how much of each, like half the water or three of the five eggs. Scaled the recipe? The linked ingredients scale along.",
      },
      {
        title: "Scaling and units",
        body: "Set the servings and every quantity re-does itself. Metric and US measurements swap with one tap.",
        ai: true,
      },
      {
        title: "Nutrition and allergies",
        body: "Calories, protein, carbs and fat estimated per recipe, per serving and allergies are flagged against what your household reacts to.",
        ai: true,
      },
      {
        title: "Plan together",
        body: "Drop recipes onto the calendar shared along your household.",
      },
      {
        title: "Shop together",
        body: "One shared list, including recurring items.",
      },
      {
        title: "Real-time, always",
        body: "Edit a recipe, tick an item, plan a recipe. The whole household sees it on every device, with refresh needed..",
      },
      {
        title: "Works even when offline",
        body: "Your fifty most recent recipes, all groceries and the current calendar window stay on the device. Changes you make offline queue up and replay themselves when you come back online.",
      },
    ],
  },
  {
    name: "Running it",
    tint: "bg-tint-text",
    features: [
      {
        title: "Bring your own AI or use the cloud",
        body: "OpenAI, Anthropic, or Ollama and LM Studio on your own machine. Use the model you like how you like.",
      },
      {
        title: "Auth how you like it",
        body: "Any OIDC provider such as Authentik, Pocket ID, GitHub, Google, or plain email and password.",
      },
      {
        title: "Thirteen languages",
        body: "English, Nederlands, Deutsch, Français, Español, Italiano, Português, Polski, Dansk, Norsk, Русский, Български and 한국어, translated by the community.",
      },
      {
        title: "Installs like an app",
        body: "Add Norish as a PWA and use it just like an app.",
      },
      {
        title: "Native apps",
        body: "iOS and Android, on the same household you already share.",
        pending: true,
      },
    ],
  },
];

export function Features() {
  return (
    <section
      className="border-border scroll-mt-24 border-t px-5 py-24 sm:px-8 sm:py-32"
      id="features"
    >
      <div className="mx-auto grid max-w-5xl gap-12 lg:grid-cols-[18rem_1fr] lg:gap-20">
        <Reveal className="lg:sticky lg:top-28 lg:self-start">
          <h2 className="font-serif text-3xl leading-tight font-medium text-balance sm:text-4xl">
            Features
          </h2>
          <p className="text-muted mt-4 text-sm leading-relaxed text-pretty">
            A recipe manager first, and then rather a lot more. All of it arrives in the same
            container; open whatever you are curious about.
          </p>
        </Reveal>

        <div>
          {/* One accordion per group. The `name` makes them exclusive where the
              browser supports it, so the list never grows past one group. */}
          <div className="border-border border-t">
            {groups.map(({ name, tint, features }, groupIndex) => (
              <Reveal key={name} delay={groupIndex * 80}>
                <details
                  className="accordion group border-border border-b"
                  name="feature-groups"
                  open={groupIndex === 0 || undefined}
                >
                  <summary className="flex cursor-pointer list-none items-center gap-2.5 py-5 [&::-webkit-details-marker]:hidden">
                    <span aria-hidden className={`size-1.5 rounded-full ${tint}`} />
                    <h3 className="text-sm font-medium">{name}</h3>
                    <span className="text-muted ml-auto flex items-center gap-3 text-xs">
                      {features.length}
                      <PlusIcon className="size-4 shrink-0 transition-transform duration-300 group-open:rotate-45" />
                    </span>
                  </summary>

                  <ul className="pb-3">
                    {features.map(({ title, body, ai, pending }) => (
                      <li
                        key={title}
                        className="border-separator grid gap-1.5 border-t py-5 sm:grid-cols-[11rem_1fr] sm:gap-8"
                      >
                        <h4 className="flex items-start gap-2 text-sm font-medium">
                          {title}
                          {pending ? (
                            <span className="text-muted border-border mt-px rounded-full border px-2 py-0.5 text-[10px] leading-4 font-normal">
                              soon
                            </span>
                          ) : null}
                        </h4>
                        <p className="text-muted text-sm leading-relaxed text-pretty">
                          {body}
                          {ai ? <sup className="text-muted/70">*</sup> : null}
                        </p>
                      </li>
                    ))}
                  </ul>
                </details>
              </Reveal>
            ))}
          </div>

          <p className="text-muted/70 mt-6 text-xs">
            * Needs an AI provider, which you bring and configure yourself.
          </p>
        </div>
      </div>
    </section>
  );
}
