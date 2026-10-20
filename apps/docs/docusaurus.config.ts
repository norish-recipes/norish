import path from "node:path";
import type * as Preset from "@docusaurus/preset-classic";
import type { Config, Plugin } from "@docusaurus/types";
import tailwindcss from "@tailwindcss/postcss";

// The docs wear the product's own HeroUI v3 + Tailwind v4 look, so Docusaurus's
// Infima stylesheet is swapped for ours: Infima's unlayered rules would outrank
// every Tailwind utility and HeroUI component style. Every component a reader
// sees is our own, under src/theme.
function norishTheme(): Plugin {
  return {
    name: "norish-theme",
    configurePostCss(options) {
      options.plugins.unshift(tailwindcss());
      return options;
    },
    configureWebpack(_config, _isServer, { currentBundler }) {
      return {
        plugins: [
          new currentBundler.instance.NormalModuleReplacementPlugin(
            /infima[\\/]dist[\\/]css[\\/]default[\\/]default\.css$/,
            path.resolve(__dirname, "src/css/custom.css")
          ),
        ],
      };
    },
  };
}

// Norish documentation site — https://docs.norish.dev
// Hosted on Cloudflare Pages, isolated from the monorepo workspace.
// Only English is built by default, so the docs deploy stays fast. Set
// DOCS_LOCALES=en,pt-BR to also build the Brazilian Portuguese site.
const DOCS_LOCALES = (process.env.DOCS_LOCALES ?? "en")
  .split(",")
  .map((locale) => locale.trim())
  .filter(Boolean);

const config: Config = {
  title: "Norish",
  tagline: "Any recipe any source",
  favicon: "brand/favicon.svg",
  // The rest of the set the app and landing link; `favicon` takes one file.
  headTags: [
    {
      tagName: "link",
      attributes: {
        rel: "icon",
        href: "/brand/favicon-96x96.png",
        sizes: "96x96",
        type: "image/png",
      },
    },
    { tagName: "link", attributes: { rel: "icon", href: "/brand/favicon.ico", sizes: "48x48" } },
    {
      tagName: "link",
      attributes: {
        rel: "apple-touch-icon",
        href: "/brand/apple-touch-icon.png",
        sizes: "180x180",
      },
    },
  ],

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
    // The AI provider and prices pages draw how a Decision fits the runtime.
    mermaid: true,
  },

  themes: ["@docusaurus/theme-mermaid"],
  plugins: [norishTheme],

  i18n: {
    defaultLocale: "en",
    locales: DOCS_LOCALES,
    localeConfigs: {
      "pt-BR": { label: "Português (Brasil)", htmlLang: "pt-BR" },
    },
  },

  presets: [
    [
      "classic",
      {
        docs: {
          // Docs are the whole site; norish.dev is the marketing front.
          routeBasePath: "/",
          sidebarPath: "./sidebars.ts",
          editUrl: "https://github.com/norish-recipes/Norish/edit/main/apps/docs/",
          // The editable `docs/` IS the live version, labeled with the current
          // release below. To cut a new release run `pnpm docs_update`: it
          // freezes the current docs under this label and bumps it to the next
          // version (don't hand-edit the label — let the script do it).
          lastVersion: "current",
          versions: {
            current: { label: "0.25.1-beta" },
          },
        },
        blog: false,
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: "img/screenshots/dashboard-web-light.jpg",
    colorMode: {
      defaultMode: "light",
      respectPrefersColorScheme: true,
    },
    // Mermaid can't read CSS variables, so the diagrams take its own calm greys.
    mermaid: {
      theme: { light: "neutral", dark: "dark" },
      options: { fontFamily: '"Inter Variable", system-ui, sans-serif' },
    },
    // Token colours come from CSS variables in custom.css, not a Prism theme.
    prism: {
      additionalLanguages: ["bash", "yaml", "json", "docker"],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
