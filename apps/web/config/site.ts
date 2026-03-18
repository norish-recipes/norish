export type SiteConfig = typeof siteConfig;

export const siteConfig = {
  name: "Norish",
  description: "Nourish every meal.",
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
    github: "https://github.com/mikevanes/norish",
  },
};
