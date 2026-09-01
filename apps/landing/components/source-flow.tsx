import type { ComponentType, SVGProps } from "react";
import { CameraIcon, ClipboardDocumentIcon, GlobeAltIcon } from "@heroicons/react/24/outline";

import { InstagramIcon, YouTubeIcon } from "./icons";
import { RecipeFragment } from "./recipe-fragment";

type Source = {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  /** Full class pairs, written out so Tailwind's scanner can see them. */
  chip: string;
  line: string;
  /** Vertical centre of this row in the connector's coordinate space. */
  y: number;
};

/**
 * Every one of these is a real import path: a page's structured data, the two
 * named video platforms, photographs read by AI, and text pasted straight in.
 * The colours belong to the diagram, not the product: they tell the strands
 * apart, and they all end at the same neutral recipe.
 */
const SOURCES: Source[] = [
  {
    icon: GlobeAltIcon,
    label: "Recipe sites",
    chip: "bg-tint-site/14 text-tint-site",
    line: "text-tint-site",
    y: 28,
  },
  {
    icon: YouTubeIcon,
    label: "YouTube videos",
    chip: "bg-tint-video/14 text-tint-video",
    line: "text-tint-video",
    y: 94,
  },
  {
    icon: InstagramIcon,
    label: "Instagram reels",
    chip: "bg-tint-social/14 text-tint-social",
    line: "text-tint-social",
    y: 160,
  },
  {
    icon: CameraIcon,
    label: "Photos",
    chip: "bg-tint-photo/14 text-tint-photo",
    line: "text-tint-photo",
    y: 226,
  },
  {
    icon: ClipboardDocumentIcon,
    label: "Pasted text",
    chip: "bg-tint-text/14 text-tint-text",
    line: "text-tint-text",
    y: 292,
  },
];

/**
 * The fan's own box: as tall as the five rows it leaves, and the run it has to
 * cross to reach the recipe. Drawn at one user unit per pixel, so the `h-80
 * w-32` it is given has to stay these two numbers.
 */
const FAN_W = 128;
const FAN_H = 320;

/**
 * Rows are 56px on a 66px pitch, so a strand meets each one at its centre.
 * They converge above the fan's own midpoint, and the fan starts level with
 * the top of the recipe, which lands the meeting point on the recipe's photo
 * rather than below it on the seam between two cards.
 */
const CONVERGE = 132;

/** A curve from a row's centre across to the card, flattening at both ends. */
function curve(y: number) {
  const bend = FAN_W / 2;

  return y === CONVERGE
    ? `M0 ${y}H${FAN_W}`
    : `M0 ${y}C${bend} ${y} ${bend} ${CONVERGE} ${FAN_W} ${CONVERGE}`;
}

/*
 * Below md the sources sit in a row and the fan drops downward instead. The
 * chips are 48px on a 60px pitch (gap-3), so a strand leaves each chip at its
 * centre and meets the others over the middle of the recipe photo.
 */
const ROW_W = 288;
const ROW_H = 88;

const chipX = (position: number) => 24 + position * 60;

/** The vertical twin of `curve`: chip centre down to the row's midline. */
function curveDown(x: number) {
  const mid = ROW_W / 2;

  return x === mid
    ? `M${x} 0V${ROW_H}`
    : `M${x} 0C${x} ${ROW_H / 2} ${mid} ${ROW_H / 2} ${mid} ${ROW_H}`;
}

/**
 * One source's line across to the recipe: the strand itself, which draws once
 * as the hero arrives, and a short dash that runs along it afterwards and keeps
 * running. Both are the same path, so the second follows the first exactly.
 */
function Strand({ d, line, position }: { d: string; line: string; position: number }) {
  const shared = {
    d,
    pathLength: 1,
    stroke: "currentColor",
    strokeWidth: 1.5,
    style: { transitionDelay: `${250 + position * 90}ms` },
  } as const;

  return (
    <g className={line}>
      <path {...shared} className="stroke-in" />
      <path
        {...shared}
        className="flow-pulse"
        strokeLinecap="round"
        strokeWidth={2.5}
        style={{ ...shared.style, animationDelay: `${position * 680}ms` }}
      />
    </g>
  );
}

/**
 * The hero diagram: five genuinely different sources, one stored recipe. It is
 * drawn as a diagram rather than a mock of the app, so it illustrates what
 * Norish does without implying an interface that does not exist. Each strand
 * keeps its own colour so the fan reads at a glance; they draw themselves as
 * the hero reveals and then carry something along themselves for as long as
 * they are on the page (see `.stroke-in` and `.flow-pulse` in globals.css).
 *
 * Wide enough for two columns, the two halves are equal and the sources are
 * pushed up against the seam between them: the fan ends where its half does,
 * so the point every strand converges on is the middle of the page, and the
 * recipe it converges on takes the half after it. The sources need less room
 * than the recipe does, so the width of the whole thing is set by the half the
 * recipe wants and the slack is left out at the far edge.
 */
export function SourceFlow() {
  return (
    <div
      aria-label="A recipe site, a YouTube video, an Instagram reel, a photo and pasted text all becoming one stored recipe"
      className="md:grid md:grid-cols-2 md:items-start"
      role="img"
    >
      {/* Below md: the same five chips in a row, fanning down into the recipe.
          The labels stay desktop-only; the subtitle has just named them. */}
      <div className="md:hidden">
        <ul className="flex items-center justify-center gap-3">
          {SOURCES.map(({ icon: Icon, label, chip }) => (
            <li key={label}>
              <span className={`grid size-12 place-items-center rounded-2xl ${chip}`}>
                <Icon className="size-6" />
              </span>
            </li>
          ))}
        </ul>

        <svg
          aria-hidden
          className="mx-auto mt-2 block"
          fill="none"
          height={ROW_H}
          viewBox={`0 0 ${ROW_W} ${ROW_H}`}
          width={ROW_W}
          xmlns="http://www.w3.org/2000/svg"
        >
          {SOURCES.map(({ label, line }, position) => (
            <Strand key={label} d={curveDown(chipX(position))} line={line} position={position} />
          ))}
        </svg>
      </div>

      <div className="hidden md:flex md:items-center md:justify-end">
        <ul className="flex flex-col gap-2.5">
          {SOURCES.map(({ icon: Icon, label, chip }) => (
            <li key={label} className="flex h-14 items-center gap-3">
              <span className={`grid size-12 shrink-0 place-items-center rounded-2xl ${chip}`}>
                <Icon className="size-6" />
              </span>
              <span className="whitespace-nowrap">{label}</span>
            </li>
          ))}
        </ul>

        <svg
          aria-hidden
          className="h-80 w-32 shrink-0"
          fill="none"
          viewBox={`0 0 ${FAN_W} ${FAN_H}`}
          xmlns="http://www.w3.org/2000/svg"
        >
          {SOURCES.map(({ label, line, y }, position) => (
            <Strand key={label} d={curve(y)} line={line} position={position} />
          ))}
        </svg>
      </div>

      <RecipeFragment />
    </div>
  );
}
