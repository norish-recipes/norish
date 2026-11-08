// NEXT_PUBLIC values are intentionally exposed to the browser by Next.js.
// eslint-disable-next-line no-restricted-properties
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION;

export type SiteConfig = typeof siteConfig;

export const siteConfig = {
  name: "Norish",
  description: "Any recipe, any source.",
  navItems: [
    {
      label: "Home",
      href: "/",
    },
    {
      label: "Groceries",
      href: "/groceries",
    },
    {
      label: "Calendar",
      href: "/calendar",
    },
  ],
  navMenuItems: [
    {
      label: "Profile",
      href: "/profile",
    },
  ],
  links: {
    github: "https://github.com/norish-recipes/norish",
  },
};
