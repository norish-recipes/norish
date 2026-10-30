import type { ReactNode } from "react";
import { links } from "@/lib/css-tokens";
import {
  CommandLineIcon,
  GlobeAltIcon,
  LockClosedIcon,
  SignalSlashIcon,
} from "@heroicons/react/24/outline";

import { BrandLogo } from "../brand-logo";
import { button } from "../button";
import { GitHubIcon } from "../icons";
import { SelfHostCompose } from "../self-host-compose";

const facts: { icon: ReactNode; title: string; detail: string }[] = [
  { icon: <SignalSlashIcon />, title: "Works offline", detail: "Syncs when you reconnect" },
  { icon: <LockClosedIcon />, title: "Sign in your way", detail: "OIDC, GitHub, Google, email" },
  { icon: <GlobeAltIcon />, title: "17 languages", detail: "From Arabic to Ukrainian" },
];

const footerLinks = [
  { label: "Docs", href: links.docs },
  { label: "GitHub", href: links.github },
  { label: "Docker Hub", href: links.dockerHub },
  { label: "Buy me a coffee", href: links.coffee },
];

/** The green band the page ends on: the compose file, what you get, and the footer. */
export function SelfHost() {
  return (
    <section className="bg-accent text-accent-foreground scroll-mt-24" id="self-host">
      <svg
        aria-hidden
        className="fill-background -mt-px block h-24 w-full"
        preserveAspectRatio="none"
        viewBox="0 0 1440 120"
      >
        <path d="M0 0H1440V40C1180 110 920 10 660 50C420 88 200 120 0 70Z" />
      </svg>

      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-12 px-4 pt-12 pb-16 sm:px-10">
        <div className="flex min-w-0 flex-1 basis-[22rem] flex-col gap-5">
          <h2 className="text-[clamp(2.5rem,5vw,4rem)] leading-[1.02] font-semibold tracking-[-0.022em]">
            Free and open source.
          </h2>
          <p className="max-w-[36ch] text-lg text-pretty opacity-85">
            Your kitchen on your server. One compose file and it is running.
          </p>
          <div className="flex flex-wrap gap-3">
            <a className={button.onAccent} href={links.selfHost}>
              <CommandLineIcon />
              Quick start
            </a>
            <a className={button.onAccentQuiet} href={links.github}>
              <GitHubIcon />
              Source code
            </a>
          </div>
        </div>
        <SelfHostCompose />
      </div>

      <ul className="mx-auto grid max-w-6xl grid-cols-[repeat(auto-fit,minmax(min(100%,16rem),1fr))] gap-4 px-4 pb-20 sm:px-10">
        {facts.map((fact) => (
          <li
            key={fact.title}
            className="bg-accent-deep flex items-center gap-4 rounded-3xl px-6 py-5"
          >
            <span className="bg-paper text-accent grid size-11 shrink-0 place-items-center rounded-full [&>svg]:size-5.5">
              {fact.icon}
            </span>
            <span className="flex flex-col gap-0.5">
              <strong className="text-[1.0625rem] font-semibold">{fact.title}</strong>
              <span className="text-[0.9375rem] opacity-85">{fact.detail}</span>
            </span>
          </li>
        ))}
      </ul>

      <footer className="border-accent-deep mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 border-t px-4 pt-10 pb-14 sm:px-10">
        <BrandLogo cream height={40} width={149} />
        <nav aria-label="Footer" className="flex flex-wrap gap-x-7 gap-y-3 text-[0.9375rem]">
          {footerLinks.map((link) => (
            <a key={link.label} className="hover:underline" href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>
      </footer>
    </section>
  );
}
