import { readFileSync } from "node:fs";
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

// Register the same redirects in the client router for links from archived docs.
function mergedDocRedirects(): Plugin {
  return {
    name: "merged-doc-redirects",
    async contentLoaded({ actions: { addRoute, createData } }) {
      const redirects = readFileSync(path.resolve(__dirname, "static/_redirects"), "utf8").trim();
      for (const line of redirects.split("\n")) {
        const [from, to] = line.split(/\s+/);
        // Frozen release notes link to these anchors on the original path.
        const anchors =
          from === "/recipes/recipe-page" ? ["units", "print-a-recipe-or-save-a-pdf"] : [];
        const data = await createData(
          `${from.slice(1).replaceAll("/", "-")}.json`,
          JSON.stringify({ to, anchors })
        );
        addRoute({
          path: from,
          exact: true,
          component: "@site/src/components/MergedDocRedirect",
          modules: { redirect: data },
        });
      }
    },
  };
}

// Norish documentation site — https://docs.norish.dev
// Hosted on Cloudflare Pages, isolated from the monorepo workspace.

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
    // Some guides use Mermaid diagrams.
    mermaid: true,
  },

  themes: ["@docusaurus/theme-mermaid"],
  plugins: [norishTheme, mergedDocRedirects],

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
            current: { label: "0.28.0-beta" },
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
