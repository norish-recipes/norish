// @vitest-environment node
/**
 * A development server must not depend on the machine's Python.
 *
 * The plain `yt-dlp` release asset is a zipapp behind `#!/usr/bin/env
 * python3`, so it runs under whatever interpreter is first on PATH and
 * inherits that interpreter's TLS trust. On a macOS python.org install whose
 * `Install Certificates.command` was never run there is no CA bundle at all,
 * and every fetch fails with CERTIFICATE_VERIFY_FAILED while the same URL
 * loads fine in any browser on the same machine.
 *
 * Production never had this problem — the image downloads a self-contained
 * musllinux build (docker/Dockerfile). These cases pin development to the
 * same kind of binary on every platform it can, which is the only way one
 * machine can check the choices made for the others.
 *
 * Asset names are the ones the pinned release publishes; `yt-dlp_linux_armv7l`
 * exists only as a `.zip`, so 32-bit ARM has no bare binary to fetch.
 */
import { describe, expect, it } from "vitest";

import { ytDlpAssetFor } from "@norish/api/video/yt-dlp";

describe("the yt-dlp release asset a host downloads", () => {
  it("takes the universal build on macOS, Apple silicon or Intel", () => {
    expect(ytDlpAssetFor("darwin", "arm64", "glibc")).toBe("yt-dlp_macos");
    expect(ytDlpAssetFor("darwin", "x64", "glibc")).toBe("yt-dlp_macos");
  });

  it("matches the Windows build to the architecture", () => {
    expect(ytDlpAssetFor("win32", "x64", "glibc")).toBe("yt-dlp.exe");
    expect(ytDlpAssetFor("win32", "arm64", "glibc")).toBe("yt-dlp_arm64.exe");
    expect(ytDlpAssetFor("win32", "ia32", "glibc")).toBe("yt-dlp_x86.exe");
  });

  it("separates glibc Linux from musl, which cannot run a glibc binary", () => {
    expect(ytDlpAssetFor("linux", "x64", "glibc")).toBe("yt-dlp_linux");
    expect(ytDlpAssetFor("linux", "arm64", "glibc")).toBe("yt-dlp_linux_aarch64");
    expect(ytDlpAssetFor("linux", "x64", "musl")).toBe("yt-dlp_musllinux");
    expect(ytDlpAssetFor("linux", "arm64", "musl")).toBe("yt-dlp_musllinux_aarch64");
  });

  it("falls back to the zipapp only where no build is published", () => {
    expect(ytDlpAssetFor("linux", "arm", "glibc")).toBe("yt-dlp");
    expect(ytDlpAssetFor("freebsd", "x64", "glibc")).toBe("yt-dlp");
  });

  it("never hands a self-contained platform the zipapp", () => {
    const covered = [
      ["darwin", "arm64"],
      ["darwin", "x64"],
      ["win32", "x64"],
      ["win32", "arm64"],
      ["win32", "ia32"],
      ["linux", "x64"],
      ["linux", "arm64"],
    ] as const;

    for (const [platform, arch] of covered) {
      for (const libc of ["glibc", "musl"] as const) {
        expect(ytDlpAssetFor(platform, arch, libc)).not.toBe("yt-dlp");
      }
    }
  });
});
