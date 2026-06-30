import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

// Norish documentation site — https://docs.norish.dev
// Hosted on Cloudflare Pages, isolated from the monorepo workspace.
const config: Config = {
  title: "Norish",
  tagline: "Any recipe any source",
  favicon: "img/favicon.svg",

  url: "https://docs.norish.dev",
  baseUrl: "/",

  organizationName: "norish-recipes",
  projectName: "Norish",

  // Fail the build on broken internal links so a bad migration link can't ship.
  onBrokenLinks: "throw",
  onBrokenAnchors: "throw",

  markdown: {
    hooks: {
      onBrokenMarkdownLinks: "warn",
    },
  },

  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  presets: [
    [
      "classic",
      {
        docs: {
          // Docs are the whole site; norish.dev is the marketing front.
          routeBasePath: "/",
          sidebarPath: "./sidebars.ts",
          editUrl:
            "https://github.com/norish-recipes/Norish/edit/main/apps/docs/",
          // The editable `docs/` IS the live version, labeled with the current
          // release below. To cut a new release run `pnpm docs_update`: it
          // freezes the current docs under this label and bumps it to the next
          // version (don't hand-edit the label — let the script do it).
          lastVersion: "current",
          versions: {
            current: { label: "0.20.0" },
          },
        },
        blog: false,
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: "img/screenshots/dashboard-web-light.jpg",
    colorMode: {
      defaultMode: "light",
      respectPrefersColorScheme: true,
    },
    navbar: {
      // The logo is a full "Norish" wordmark, so no separate title text.
      logo: {
        alt: "Norish",
        src: "img/logo.svg",
        href: "/",
        width: 104,
        height: 28,
      },
      items: [
        {
          type: "docsVersionDropdown",
          position: "right",
        },
        {
          href: "https://norish.dev",
          label: "norish.dev",
          position: "right",
        },
        {
          href: "https://github.com/norish-recipes/Norish",
          label: "GitHub",
          position: "right",
        },
      ],
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "Docs",
          items: [
            { label: "Introduction", to: "/" },
            { label: "Quick start", to: "/quick-start" },
            { label: "Authentication", to: "/configuration/authentication" },
            { label: "API reference", to: "/reference/api" },
          ],
        },
        {
          title: "Project",
          items: [
            { label: "Website", href: "https://norish.dev" },
            { label: "GitHub", href: "https://github.com/norish-recipes/Norish" },
            { label: "Docker Hub", href: "https://hub.docker.com/r/norishapp/norish" },
          ],
        },
        {
          title: "Community",
          items: [
            {
              label: "Issues",
              href: "https://github.com/norish-recipes/Norish/issues",
            },
            {
              label: "Buy Me a Coffee",
              href: "https://buymeacoffee.com/mikevanes",
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Norish. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ["bash", "yaml", "json", "docker"],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
