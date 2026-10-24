import "./globals.css";

import type { Metadata, Viewport } from "next";

import { Providers } from "./providers";

const title = "Norish: any recipe, any source.";
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
      { url: "/brand/favicon.svg", type: "image/svg+xml" },
      { url: "/brand/favicon-96x96.png", sizes: "96x96", type: "image/png" },
      { url: "/brand/favicon.ico", sizes: "48x48" },
    ],
    apple: [{ url: "/brand/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    url: "https://norish.dev",
    siteName: "Norish",
    title,
    description,
    images: [{ url: "/screenshots/og.jpg", width: 1200, height: 630, alt: "Norish" }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/screenshots/og.jpg"],
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

// Scroll reveals hide their content until observed. Marking the document as
// scripted lets that rule apply only where JS can undo it, so a scripting-free
// browser still gets a fully readable page.
const markScripted = `document.documentElement.classList.add("js")`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html suppressHydrationWarning lang="en">
      <head>
        {/* A constant, and React escapes a script's text children, so it goes in as raw HTML. */}
        {/* eslint-disable-next-line @eslint-react/dom-no-dangerously-set-innerhtml */}
        <script dangerouslySetInnerHTML={{ __html: markScripted }} />
      </head>
      <body className="bg-background text-foreground min-h-dvh font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
