import { links } from "@/lib/css-tokens";

import { BrandLogo } from "../brand-logo";
import { GitHubIcon } from "../icons";

const columns = [
  {
    title: "Product",
    items: [
      { label: "Features", href: "#features" },
      { label: "Getting started", href: "#self-host" },
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
    <footer className="border-border border-t px-5 py-14 sm:px-8">
      <div className="mx-auto grid max-w-5xl gap-10 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto] lg:gap-20">
        <div>
          <BrandLogo height={26} width={97} />
          <p className="text-muted mt-4 max-w-xs text-sm text-pretty">
            The open-source recipe app for families &amp; friends.
          </p>
          <a
            aria-label="Norish on GitHub"
            className="text-muted hover:text-foreground mt-5 inline-grid size-9 place-items-center rounded-full transition-colors"
            href={links.github}
            rel="noreferrer"
            target="_blank"
          >
            <GitHubIcon className="size-4.5" />
          </a>
        </div>

        {columns.map((column) => (
          <div key={column.title}>
            <h3 className="text-sm font-medium">{column.title}</h3>
            <ul className="mt-4 space-y-2.5">
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

      <div className="border-border mx-auto mt-12 flex max-w-5xl flex-col gap-2 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted/70 text-xs">
          © {new Date().getFullYear()} Norish is released under the AGPL-3.0 License.
        </p>
        <p className="text-muted/70 text-xs">Built for people who love to cook.</p>
      </div>
    </footer>
  );
}
