/**
 * A WAV copy of extracted audio, for transcription endpoints that read only WAV.
 *
 * Norish extracts speech as 64 kbps MP3 (#439: WAV made long videos exceed the
 * 100 MB upload limits of Whisper servers). Some OpenAI-compatible endpoints
 * decode nothing but WAV - mlx-serve's Qwen3-ASR refuses an MP3 with a 400 -
 * so a refused MP3 is sent again as 16 kHz mono 16-bit PCM: the rate speech
 * models resample to anyway, at about 2 MB a minute.
 */

import { execFile } from "node:child_process";
import { rm } from "node:fs/promises";
import { promisify } from "node:util";

import { getFfmpegPath } from "@norish/shared-server/media/ffmpeg";

const execFileAsync = promisify(execFile);

/** Run `send` on a 16 kHz mono WAV copy of the audio, removing the copy after. */
export async function withWavCopy<T>(
  audioPath: string,
  send: (wavPath: string) => Promise<T>
): Promise<T> {
  const ffmpegPath = getFfmpegPath();

  if (!ffmpegPath) throw new Error("ffmpeg not found, cannot convert the audio to WAV");

  const wavPath = `${audioPath}.16k.wav`;

  try {
    await execFileAsync(
      ffmpegPath,
      [
        "-y",
        "-v",
        "error",
        "-i",
        audioPath,
        "-ac",
        "1",
        "-ar",
        "16000",
        "-c:a",
        "pcm_s16le",
        wavPath,
      ],
      { windowsHide: true }
    );

    return await send(wavPath);
  } finally {
    await rm(wavPath, { force: true });
  }
}
