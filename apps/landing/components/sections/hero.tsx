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
    <section className="relative overflow-hidden px-4 pt-28 pb-20 sm:pt-36 sm:pb-28" id="top">
      <GradientMesh />

      <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-2 lg:gap-10">
        {/* Copy */}
        <div className="mx-auto max-w-xl text-center lg:mx-0 lg:text-left">
          <motion.h1
            animate="show"
            className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl xl:text-6xl"
            custom={0}
            initial={enter}
            variants={fadeUp}
          >
            Any <span className="text-accent">recipe</span>,
            <br className="hidden sm:block" /> any <span className="text-accent">source</span>
          </motion.h1>

          <motion.p
            animate="show"
            className="text-muted mx-auto mt-5 max-w-xl text-base text-pretty sm:text-lg lg:mx-0"
            custom={1}
            initial={enter}
            variants={fadeUp}
          >
            Paste a link from any website, blog or app, even a TikTok or YouTube video, and Norish
            imports it clean and structured in seconds.
          </motion.p>

          <motion.div
            animate="show"
            className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start"
            custom={2}
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
        </div>

        {/* Device showcase */}
        <div className="relative mx-auto w-full max-w-xl lg:mx-0 lg:max-w-none">
          <motion.div
            animate={reduce ? undefined : { opacity: 1, y: 0, scale: 1 }}
            className="relative"
            initial={reduce ? false : { opacity: 0, y: 18, scale: 0.96 }}
            transition={{ duration: 0.9, delay: 0.4, ease }}
          >
            <div
              aria-hidden
              className="bg-accent/10 absolute -inset-x-6 -inset-y-8 -z-10 rounded-[2.5rem] blur-3xl"
            />

            <BrowserFrame>
              <ThemedShot
                priority
                alt="The Norish recipe dashboard"
                base="dashboard-web"
                className="h-auto w-full"
                height={1340}
                sizes="(max-width: 1024px) 100vw, 560px"
                width={1800}
              />
            </BrowserFrame>
          </motion.div>

          <motion.div
            animate={reduce ? undefined : { opacity: 1, y: 0, scale: 1 }}
            className="absolute -right-2 -bottom-8 w-28 sm:w-32 lg:w-40"
            initial={reduce ? false : { opacity: 0, y: 28, scale: 0.94 }}
            transition={{ duration: 0.85, delay: 0.85, ease }}
          >
            <PhoneFrame>
              <ThemedShot
                alt="Norish on mobile"
                base="dashboard-mobile"
                className="h-auto w-full"
                height={1100}
                sizes="180px"
                width={555}
              />
            </PhoneFrame>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
