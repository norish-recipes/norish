import { CheckIcon, ClockIcon } from "@heroicons/react/24/outline";

import { BrowserFrame, PhoneFrame } from "../frames";
import { Reveal } from "../motion/reveal";
import { ThemedShot } from "../themed-shot";

/** A bullet is either available (green check) or still in the works (amber clock). */
type BulletItem = string | { label: string; pending: true };

function Bullets({ items, note }: { items: BulletItem[]; note?: string }) {
  return (
    <>
      <ul className="mt-6 space-y-3">
        {items.map((raw) => {
          const { label, pending } = typeof raw === "string" ? { label: raw, pending: false } : raw;

          return (
            <li key={label} className="flex items-start gap-3">
              <span
                className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ${
                  pending ? "bg-amber-500/15 text-amber-500" : "bg-accent/10 text-accent"
                }`}
              >
                {pending ? <ClockIcon className="size-3.5" /> : <CheckIcon className="size-3.5" />}
              </span>
              <span className="text-muted text-sm text-pretty">{label}</span>
            </li>
          );
        })}
      </ul>
      {note ? <p className="text-muted/80 mt-4 text-xs text-pretty">{note}</p> : null}
    </>
  );
}

export function ScreenshotShowcase() {
  return (
    <section className="bg-surface-secondary/30 scroll-mt-24 px-4 py-20 sm:py-28" id="showcase">
      <div className="mx-auto flex max-w-6xl flex-col gap-24">
        {/* Row 1 — recipe page on the web */}
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <p className="text-accent text-sm font-semibold tracking-wide uppercase">
              The recipe page
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              A recipe page you&apos;ll want to cook from
            </h2>
            <Bullets
              items={[
                "Scale any recipe to the servings you need",
                "One-tap metric ⇄ US unit conversion*",
                "Estimate nutritional information*",
                "Detect allergies and flag them*",
              ]}
              note="* Requires an AI provider, which you bring and configure yourself."
            />
          </Reveal>

          <Reveal delay={0.1}>
            <BrowserFrame url="norish.dev/recipes">
              <ThemedShot
                alt="A Norish recipe page"
                base="recipe-web"
                className="h-auto w-full"
                height={1349}
                sizes="(max-width: 1024px) 100vw, 560px"
                width={1800}
              />
            </BrowserFrame>
          </Reveal>
        </div>

        {/* Row 2 — mobile */}
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <Reveal className="order-2 lg:order-1">
            <div className="relative mx-auto flex max-w-md justify-center gap-4">
              <PhoneFrame className="w-44 translate-y-4 sm:w-48">
                <ThemedShot
                  alt="Norish dashboard on mobile"
                  base="dashboard-mobile"
                  className="h-auto w-full"
                  height={1100}
                  sizes="200px"
                  width={555}
                />
              </PhoneFrame>
              <PhoneFrame className="w-44 -translate-y-4 sm:w-48">
                <ThemedShot
                  alt="Norish recipe on mobile"
                  base="recipe-mobile"
                  className="h-auto w-full"
                  height={1100}
                  sizes="200px"
                  width={555}
                />
              </PhoneFrame>
            </div>
          </Reveal>

          <Reveal className="order-1 lg:order-2" delay={0.1}>
            <p className="text-accent text-sm font-semibold tracking-wide uppercase">
              On every device
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Made for the way you really cook
            </h2>
            <Bullets
              items={[
                "Installable PWA, add it to your home screen",
                "Polished light and dark themes",
                "Available in 10 languages",
                { label: "Native apps in the works", pending: true },
              ]}
            />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
