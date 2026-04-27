import { describe, it, expect, vi, beforeEach } from "vitest";
import fc from "fast-check";

vi.mock("@actions/github", () => ({
  getOctokit: vi.fn(),
}));

import * as github from "@actions/github";
import { resolveVersion } from "../version-resolver.js";

/**
 * Invalid version errors include the requested version string
 */
describe("Invalid version errors include the requested version string", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Generate random non-release version strings (semver-like but unlikely to exist).
   * Uses high major versions to ensure they don't match real releases.
   */
  const nonReleaseVersionArb = fc
    .record({
      major: fc.integer({ min: 900, max: 999 }),
      minor: fc.integer({ min: 0, max: 99 }),
      patch: fc.integer({ min: 0, max: 99 }),
    })
    .map(({ major, minor, patch }) => `${major}.${minor}.${patch}`);

  it("error message contains the requested version string verbatim", async () => {
    await fc.assert(
      fc.asyncProperty(nonReleaseVersionArb, async (version) => {
        const error404 = new Error("Not Found") as Error & { status: number };
        error404.status = 404;

        vi.mocked(github.getOctokit).mockReturnValue({
          rest: {
            repos: {
              getLatestRelease: vi.fn(),
              getReleaseByTag: vi.fn().mockRejectedValue(error404),
            },
          },
        } as unknown as ReturnType<typeof github.getOctokit>);

        try {
          await resolveVersion(version, "fake-token");
          expect.fail("Expected resolveVersion to throw");
        } catch (err) {
          expect((err as Error).message).toContain(version);
        }
      }),
      { numRuns: 100 }
    );
  });
});
