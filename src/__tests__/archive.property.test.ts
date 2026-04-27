import { describe, it, expect, vi } from "vitest";
import fc from "fast-check";
import * as semver from "semver";

vi.mock("@actions/tool-cache", () => ({
  downloadTool: vi.fn(),
  extractZip: vi.fn(),
  extractTar: vi.fn(),
}));

import { getArchiveFormat, getDownloadUrl } from "../archive.js";

/**
 * Archive format is determined by version threshold
 */
describe("Archive format is determined by version threshold", () => {
  /** Arbitrary that generates valid semver strings across a wide range. */
  const semverArb = fc
    .record({
      major: fc.integer({ min: 0, max: 5 }),
      minor: fc.integer({ min: 0, max: 99 }),
      patch: fc.integer({ min: 0, max: 99 }),
    })
    .map(({ major, minor, patch }) => `${major}.${minor}.${patch}`);

  it("returns 'zip' iff version >= 1.47.0 and 'tar.gz' otherwise", () => {
    fc.assert(
      fc.property(semverArb, (version) => {
        const result = getArchiveFormat(version);
        if (semver.gte(version, "1.47.0")) {
          expect(result).toBe("zip");
        } else {
          expect(result).toBe("tar.gz");
        }
      }),
      { numRuns: 200 }
    );
  });

  it("format is always one of 'zip' or 'tar.gz'", () => {
    fc.assert(
      fc.property(semverArb, (version) => {
        const result = getArchiveFormat(version);
        expect(["zip", "tar.gz"]).toContain(result);
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Download URL is well-formed for all valid versions and platforms
 */
describe("Download URL is well-formed for all valid versions and platforms", () => {
  const validPlatforms = [
    { platform: "linux", arch: "arm64", smithyOs: "linux", smithyArch: "aarch64" },
    { platform: "linux", arch: "x64", smithyOs: "linux", smithyArch: "x86_64" },
    { platform: "darwin", arch: "arm64", smithyOs: "darwin", smithyArch: "aarch64" },
    { platform: "darwin", arch: "x64", smithyOs: "darwin", smithyArch: "x86_64" },
    { platform: "win32", arch: "x64", smithyOs: "windows", smithyArch: "x64" },
  ] as const;

  const platformArb = fc.constantFrom(...validPlatforms);

  const versionArb = fc
    .record({
      major: fc.integer({ min: 1, max: 3 }),
      minor: fc.integer({ min: 0, max: 99 }),
      patch: fc.integer({ min: 0, max: 99 }),
    })
    .map(({ major, minor, patch }) => `${major}.${minor}.${patch}`);

  it("URL starts with the correct base, contains version, and has correct extension", () => {
    fc.assert(
      fc.property(versionArb, platformArb, (version, plat) => {
        const originalPlatform = process.platform;
        const originalArch = process.arch;
        try {
          Object.defineProperty(process, "platform", { value: plat.platform, configurable: true });
          Object.defineProperty(process, "arch", { value: plat.arch, configurable: true });

          const format = getArchiveFormat(version);
          const url = getDownloadUrl(version, format);

          expect(url).toMatch(
            /^https:\/\/github\.com\/smithy-lang\/smithy\/releases\/download\//
          );
          expect(url).toContain(version);
          expect(url).toContain(`smithy-cli-${plat.smithyOs}-${plat.smithyArch}`);
          expect(url).toMatch(format === "zip" ? /\.zip$/ : /\.tar\.gz$/);
        } finally {
          Object.defineProperty(process, "platform", { value: originalPlatform, configurable: true });
          Object.defineProperty(process, "arch", { value: originalArch, configurable: true });
        }
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Download failure errors include the attempted URL
 */
describe("Download failure errors include the attempted URL", () => {
  const versionArb = fc
    .record({
      major: fc.integer({ min: 1, max: 3 }),
      minor: fc.integer({ min: 0, max: 99 }),
      patch: fc.integer({ min: 0, max: 99 }),
    })
    .map(({ major, minor, patch }) => `${major}.${minor}.${patch}`);

  it("download failure error contains the full URL that was attempted", async () => {
    const { downloadAndExtract, getDownloadUrl, getArchiveFormat } = await import("../archive.js");
    const tc = await import("@actions/tool-cache");

    const originalPlatform = process.platform;
    const originalArch = process.arch;

    await fc.assert(
      fc.asyncProperty(versionArb, async (version) => {
        Object.defineProperty(process, "platform", { value: "linux", configurable: true });
        Object.defineProperty(process, "arch", { value: "x64", configurable: true });

        try {
          const format = getArchiveFormat(version);
          const expectedUrl = getDownloadUrl(version, format);

          vi.mocked(tc.downloadTool).mockRejectedValue(new Error("Network error"));

          try {
            await downloadAndExtract(version);
            expect.fail("Expected downloadAndExtract to throw");
          } catch (err) {
            expect((err as Error).message).toContain(expectedUrl);
          }
        } finally {
          Object.defineProperty(process, "platform", { value: originalPlatform, configurable: true });
          Object.defineProperty(process, "arch", { value: originalArch, configurable: true });
        }
      }),
      { numRuns: 100 }
    );
  });
});
