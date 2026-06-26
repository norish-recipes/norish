import "./globals.css";

import type { Metadata, Viewport } from "next";

import { Providers } from "./providers";

const title = "Norish: Nourish every meal.";
const description =
  "The open-source recipe app for families & friends. Import recipes from any link, plan your meals together, and keep your grocery lists in sync when shopping together. Free, open source and self-hostable.";

export const metadata: Metadata = {
  metadataBase: new URL("https://norish.dev"),
  title: {
    default: title,
    template: "%s | Norish",
  },
  description,
  applicationName: "Norish",
  keywords: [
    "recipe app",
    "meal planning",
    "self-hosted",
    "open source",
    "nutrition tracking",
    "grocery list",
    "household recipes",
  ],
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    url: "https://norish.dev",
    siteName: "Norish",
    title,
    description,
    images: [
      { url: "/screenshots/dashboard-web-light.jpg", width: 1800, height: 1300, alt: "Norish" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/screenshots/dashboard-web-light.jpg"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fffef7" },
    { media: "(prefers-color-scheme: dark)", color: "#336640" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html suppressHydrationWarning lang="en">
      <body className="bg-background text-foreground min-h-dvh font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
