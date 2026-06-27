"use client";

import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { motion, useReducedMotion } from "motion/react";

import { CTAButton } from "../cta-button";
import { BrowserFrame, PhoneFrame } from "../frames";
import { GitHubIcon } from "../icons";
import { GradientMesh } from "../motion/gradient-mesh";
import { ThemedShot } from "../themed-shot";

import { links } from "@/lib/css-tokens";

const ease = [0.22, 1, 0.36, 1] as const;

const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, delay: 0.1 + i * 0.09, ease },
  }),
};

export function Hero() {
  const reduce = useReducedMotion();
  const enter = reduce ? false : "hidden";

  return (
    <section className="relative overflow-hidden px-4 pt-28 pb-12 sm:pt-36 sm:pb-20" id="top">
      <GradientMesh />

      <div className="mx-auto max-w-3xl text-center">
        <motion.a
          animate="show"
          className="border-border bg-surface/70 text-muted hover:text-foreground inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs backdrop-blur transition-colors"
          custom={0}
          href={links.github}
          initial={enter}
          rel="noreferrer"
          target="_blank"
          variants={fadeUp}
        >
          <span className="bg-accent size-1.5 animate-pulse rounded-full" />
          100% open source · Self-hosted
          <ArrowRightIcon className="size-3.5" />
        </motion.a>

        <motion.h1
          animate="show"
          className="mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-6xl"
          custom={1}
          initial={enter}
          variants={fadeUp}
        >
          Any <span className="text-accent">recipe</span>,
          <br className="hidden sm:block" /> from <span className="text-accent">anywhere.</span>
        </motion.h1>

        <motion.p
          animate="show"
          className="text-muted mx-auto mt-5 max-w-xl text-base text-pretty sm:text-lg"
          custom={2}
          initial={enter}
          variants={fadeUp}
        >
          Paste a link from any website, blog or app, even a TikTok or YouTube video, and Norish
          imports it clean and structured in seconds.
        </motion.p>

        <motion.div
          animate="show"
          className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
          custom={3}
          initial={enter}
          variants={fadeUp}
        >
          <CTAButton className="w-full sm:w-auto" href="#self-host" size="lg">
            Get started
            <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
          </CTAButton>
          <CTAButton
            external
            className="w-full sm:w-auto"
            href={links.github}
            size="lg"
            variant="secondary"
          >
            <GitHubIcon className="size-4.5" />
            View on GitHub
          </CTAButton>
        </motion.div>

        <motion.p
          animate="show"
          className="text-muted mt-4 text-xs"
          custom={4}
          initial={enter}
          variants={fadeUp}
        >
          Free and open source. Self-host it in minutes.
        </motion.p>
      </div>

      {/* Device showcase */}
      <div className="relative mx-auto mt-14 max-w-5xl sm:mt-20">
        <motion.div
          animate={{ opacity: 1, scale: 1 }}
          initial={reduce ? false : { opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.9, delay: 0.5, ease }}
        >
          <BrowserFrame>
            <ThemedShot
              priority
              alt="The Norish recipe dashboard"
              base="dashboard-web"
              className="h-auto w-full"
              height={1340}
              sizes="(max-width: 1024px) 100vw, 1024px"
              width={1800}
            />
          </BrowserFrame>

          <div className="absolute -right-2 -bottom-8 hidden w-40 sm:block lg:-right-10 lg:w-52">
            <PhoneFrame className="animate-float">
              <ThemedShot
                alt="Norish on mobile"
                base="dashboard-mobile"
                className="h-auto w-full"
                height={1100}
                sizes="220px"
                width={555}
              />
            </PhoneFrame>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
