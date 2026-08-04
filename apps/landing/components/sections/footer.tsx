import { links } from "@/lib/css-tokens";

import { BrandLogo } from "../brand-logo";
import { GitHubIcon } from "../icons";

const columns = [
  {
    title: "Product",
    items: [
      { label: "Features", href: "#features" },
      { label: "Showcase", href: "#showcase" },
      { label: "How it works", href: "#how" },
      { label: "Self-host", href: "#self-host" },
    ],
  },
  {
    title: "Project",
    items: [
      { label: "GitHub", href: links.github, external: true },
      { label: "Documentation", href: links.docs, external: true },
      { label: "Deploy guide", href: links.selfHost, external: true },
      { label: "AGPL-3.0 License", href: links.license, external: true },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-border/60 border-t px-4 py-14">
      <div className="mx-auto grid max-w-6xl gap-10 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <BrandLogo height={28} width={104} />
          <p className="text-muted mt-4 max-w-xs text-sm text-pretty">
            The open-source recipe app for families &amp; friends. Nourish every meal.
          </p>
          <a
            aria-label="Norish on GitHub"
            className="border-border bg-surface text-foreground hover:bg-surface-secondary mt-5 inline-grid size-9 place-items-center rounded-full border transition-colors"
            href={links.github}
            rel="noreferrer"
            target="_blank"
          >
            <GitHubIcon className="size-4.5" />
          </a>
        </div>

        {columns.map((column) => (
          <div key={column.title}>
            <h3 className="text-sm font-semibold">{column.title}</h3>
            <ul className="mt-4 space-y-3">
              {column.items.map((item) => (
                <li key={item.label}>
                  <a
                    href={item.href}
                    {...("external" in item && item.external
                      ? { target: "_blank", rel: "noreferrer" }
                      : {})}
                    className="text-muted hover:text-foreground text-sm transition-colors"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-border/60 mx-auto mt-12 flex max-w-6xl flex-col items-center justify-between gap-3 border-t pt-6 sm:flex-row">
        <p className="text-muted text-xs">
          © {new Date().getFullYear()} Norish · Released under the AGPL-3.0 License.
        </p>
        <p className="text-muted text-xs">Built for people who love to cook.</p>
      </div>
    </footer>
  );
}
