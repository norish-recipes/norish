import { execFile } from "node:child_process";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import sharp, { type OverlayOptions } from "sharp";
import { z } from "zod";

import { SERVER_CONFIG } from "@norish/config/env-config-server";
import { getFfmpegPath } from "@norish/api/video/yt-dlp";
import { isAIEnabled } from "@norish/shared-server/config/server-config-loader";
import { generateStructured } from "@norish/shared-server/ai/runtime/runtime";
import { downloadImage, saveImageBytes } from "@norish/shared-server/media/storage";
import { videoLogger as log } from "@norish/shared-server/logger";

const execFileAsync = promisify(execFile);

export const frameSelectionSchema = z.object({
  reasoning: z
    .string()
    .describe("Brief visual comparison of candidate finished dish frames vs cooking/prep/people frames"),
  selectedFrame: z
    .number()
    .int()
    .min(1)
    .describe("The 1-based index of the best frame in the collage representing the close-up finished dish"),
});

export type FrameSelectionResult = z.infer<typeof frameSelectionSchema>;

export interface FrameCandidate {
  index: number;
  timestamp: number;
  filePath: string;
}

/**
 * Probe actual video duration using ffprobe when duration is missing from platform metadata.
 */
export async function probeVideoDuration(
  videoPath: string,
  ffmpegPath: string
): Promise<number | null> {
  const ffprobeBinary = process.platform === "win32" ? "ffprobe.exe" : "ffprobe";
  const siblingPath = path.join(path.dirname(ffmpegPath), ffprobeBinary);
  const ffprobePath = fsSync.existsSync(siblingPath) ? siblingPath : ffprobeBinary;

  try {
    const { stdout } = await execFileAsync(ffprobePath, [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      videoPath,
    ]);

    const parsed = parseFloat(stdout.trim());

    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  } catch (err) {
    log.debug({ err, videoPath }, "Could not probe video duration via ffprobe");

    return null;
  }
}

/**
 * Calculate candidate timestamps across a video for thumbnail extraction.
 *
 * Food videos on Reels/TikTok/Shorts present teaser shots of the finished dish
 * in the hook (0-15%), cooking action in the middle (~40%), and plating/reveal
 * shots in the final third (65-98%).
 */
export function calculateCandidateTimestamps(duration?: number | null, count = 9): number[] {
  if (!duration || duration <= 0) {
    return [1.5, 4, 8, 15, 25, 40, 55, 75, 95].slice(0, count);
  }

  if (duration <= 8) {
    const step = duration / (count + 1);

    return Array.from({ length: count }, (_, i) => Number(((i + 1) * step).toFixed(2)));
  }

  if (duration <= 120) {
    const hookCount = Math.min(3, Math.max(1, Math.floor(count / 3)));
    const midCount = 1;
    const platingCount = count - hookCount - midCount;

    const hookTimes = [
      Math.min(1.5, duration * 0.05),
      Math.min(3.5, duration * 0.10),
      Math.min(6.5, duration * 0.18),
    ].slice(0, hookCount);

    const midTime = Number((duration * 0.42).toFixed(2));

    const platingTimes = Array.from({ length: platingCount }, (_, i) => {
      const frac = 0.65 + (0.96 - 0.65) * (i / Math.max(1, platingCount - 1));

      return Number((duration * frac).toFixed(2));
    });

    return [...hookTimes.map((t) => Number(t.toFixed(2))), midTime, ...platingTimes];
  }

  const hookTimes = [2, 6];
  const midTimes = [Number((duration * 0.30).toFixed(2)), Number((duration * 0.55).toFixed(2))];
  const platingCount = Math.max(1, count - hookTimes.length - midTimes.length);
  const platingTimes = Array.from({ length: platingCount }, (_, i) => {
    const frac = 0.75 + (0.98 - 0.75) * (i / Math.max(1, platingCount - 1));

    return Number((duration * frac).toFixed(2));
  });

  return [...hookTimes, ...midTimes, ...platingTimes];
}

/**
 * Extract a single video frame at a given timestamp using FFmpeg.
 */
export async function extractFrame(
  videoPath: string,
  timestamp: number,
  outputPath: string,
  ffmpegPath: string
): Promise<boolean> {
  try {
    await execFileAsync(ffmpegPath, [
      "-ss",
      timestamp.toString(),
      "-i",
      videoPath,
      "-frames:v",
      "1",
      "-q:v",
      "2",
      "-y",
      outputPath,
    ]);

    return true;
  } catch (err) {
    log.debug({ err, timestamp, videoPath }, "Failed to extract video frame");

    return false;
  }
}

/**
 * Build an aspect-ratio-aware contact sheet collage image with numbered corner badges.
 */
export async function createFrameCollage(
  frames: FrameCandidate[],
  defaultTileWidth = 320,
  defaultTileHeight = 180
): Promise<Buffer> {
  const count = frames.length;

  if (count === 0) {
    throw new Error("Cannot create collage with zero frames");
  }

  const cols = count <= 4 ? 2 : 3;
  const rows = Math.ceil(count / cols);

  let frameRatio = defaultTileWidth / defaultTileHeight;

  try {
    const meta = await sharp(frames[0]!.filePath).metadata();

    if (meta.width && meta.height && meta.height > 0) {
      frameRatio = meta.width / meta.height;
    }
  } catch (_err) {
    // Fall back to default aspect ratio
  }

  let tileWidth: number;
  let tileHeight: number;

  if (frameRatio < 0.8) {
    // Vertical / Portrait (e.g. 9:16 vertical reels/shorts)
    tileWidth = 240;
    tileHeight = Math.round(240 / frameRatio);
  } else if (frameRatio <= 1.25) {
    // Square / Near square
    tileWidth = 260;
    tileHeight = 260;
  } else {
    // Landscape (e.g. 16:9)
    tileHeight = 200;
    tileWidth = Math.round(200 * frameRatio);
  }

  const gap = 8;
  const bannerHeight = 34;

  const canvasWidth = cols * tileWidth + (cols + 1) * gap;
  const canvasHeight = rows * tileHeight + (rows + 1) * gap;

  const compositeOperations: OverlayOptions[] = [];

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i]!;
    const col = i % cols;
    const row = Math.floor(i / cols);

    const left = gap + col * (tileWidth + gap);
    const top = gap + row * (tileHeight + gap);

    const bannerSvg = Buffer.from(`
      <svg width="${tileWidth}" height="${bannerHeight}">
        <rect x="0" y="0" width="${tileWidth}" height="${bannerHeight}" fill="#0f172a" fill-opacity="0.95"/>
        <text x="${tileWidth / 2}" y="24" font-family="Arial, system-ui, sans-serif" font-size="18" font-weight="900" fill="#38bdf8" text-anchor="middle">FRAME ${frame.index}</text>
      </svg>
    `);

    const resizedFrame = await sharp(frame.filePath)
      .resize(tileWidth, tileHeight, { fit: "cover", position: "center" })
      .composite([{ input: bannerSvg, top: 0, left: 0 }])
      .toBuffer();

    compositeOperations.push({
      input: resizedFrame,
      top,
      left,
    });
  }

  return sharp({
    create: {
      width: canvasWidth,
      height: canvasHeight,
      channels: 3,
      background: { r: 15, g: 23, b: 42 },
    },
  })
    .composite(compositeOperations)
    .jpeg({ quality: 85 })
    .toBuffer();
}

/**
 * Ask the AI Vision runtime to select the best frame from the collage.
 */
export async function selectBestFrameWithVision(
  collageBuffer: Buffer,
  frameCount: number,
  recipeTitle?: string
): Promise<number | null> {
  try {
    const base64Data = collageBuffer.toString("base64");
    const sections = recipeTitle
      ? [`Recipe Title: ${recipeTitle}`]
      : [];

    const result = await generateStructured({
      prompt: "video-thumbnail-selection",
      schema: frameSelectionSchema,
      images: [{ data: base64Data, mimeType: "image/jpeg" }],
      sections,
    });

    if (result.selectedFrame >= 1 && result.selectedFrame <= frameCount) {
      log.info(
        { selectedFrame: result.selectedFrame, reasoning: result.reasoning, frameCount },
        "AI selected video thumbnail frame"
      );

      return result.selectedFrame;
    }

    log.warn(
      { selectedFrame: result.selectedFrame, frameCount },
      "AI returned out-of-range frame index"
    );

    return null;
  } catch (error) {
    log.warn({ err: error }, "Failed to select video thumbnail frame with AI");

    return null;
  }
}

export interface SelectVideoThumbnailOptions {
  videoPath: string;
  recipeId: string;
  recipeTitle?: string;
  duration?: number | null;
  fallbackThumbnailUrl?: string | null;
}

/**
 * Extract candidate frames from a video, create a numbered collage,
 * consult the AI vision model for the best shot, and save the winning frame.
 * Falls back to static URL or heuristic timestamp if AI or frame extraction fails.
 */
export async function selectAndSaveVideoThumbnail(
  options: SelectVideoThumbnailOptions
): Promise<string | undefined> {
  const { videoPath, recipeId, recipeTitle, duration, fallbackThumbnailUrl } = options;

  const ffmpegPath = getFfmpegPath();

  if (!ffmpegPath) {
    log.debug("ffmpeg binary not available, falling back to static thumbnail URL");

    return fallbackToUrl(fallbackThumbnailUrl, recipeId);
  }

  const tempDir = path.join(os.tmpdir(), `norish-thumb-${recipeId}-${Date.now()}`);

  await fs.mkdir(tempDir, { recursive: true });

  try {
    let effectiveDuration = duration;

    if (!effectiveDuration || effectiveDuration <= 0) {
      effectiveDuration = await probeVideoDuration(videoPath, ffmpegPath);
    }

    const timestamps = calculateCandidateTimestamps(effectiveDuration, 9);
    const candidateFrames: FrameCandidate[] = [];

    for (let i = 0; i < timestamps.length; i++) {
      const ts = timestamps[i]!;
      const framePath = path.join(tempDir, `frame-${i + 1}.jpg`);
      const success = await extractFrame(videoPath, ts, framePath, ffmpegPath);

      if (success) {
        candidateFrames.push({
          index: i + 1,
          timestamp: ts,
          filePath: framePath,
        });
      }
    }

    if (candidateFrames.length === 0) {
      log.warn("No frames could be extracted from video, falling back to URL");

      return fallbackToUrl(fallbackThumbnailUrl, recipeId);
    }

    let winningIndex: number | null = null;

    if (await isAIEnabled()) {
      const collageBuffer = await createFrameCollage(candidateFrames);

      winningIndex = await selectBestFrameWithVision(
        collageBuffer,
        candidateFrames.length,
        recipeTitle
      );
    }

    // If AI failed or was disabled, pick candidate frame near 85% of duration (the plating reveal)
    const winningFrame =
      (winningIndex ? candidateFrames.find((f) => f.index === winningIndex) : null) ??
      candidateFrames[Math.min(candidateFrames.length - 2, Math.max(0, candidateFrames.length - 1))] ??
      candidateFrames[0]!;

    const frameBytes = await fs.readFile(winningFrame.filePath);
    const savedPath = await saveImageBytes(frameBytes, recipeId);

    log.info(
      { recipeId, winningIndex: winningFrame.index, timestamp: winningFrame.timestamp, savedPath },
      "Saved selected video frame as recipe thumbnail"
    );

    return savedPath;
  } catch (error) {
    log.warn({ err: error, recipeId }, "Failed during video thumbnail extraction and selection");

    return fallbackToUrl(fallbackThumbnailUrl, recipeId);
  } finally {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (_cleanupErr) {
      // Ignore temp directory cleanup errors
    }
  }
}

async function fallbackToUrl(
  url: string | null | undefined,
  recipeId: string
): Promise<string | undefined> {
  if (!url) return undefined;
  try {
    return await downloadImage(url, recipeId);
  } catch (_err) {
    log.debug({ url, recipeId }, "Failed to download fallback video thumbnail URL");

    return undefined;
  }
}
