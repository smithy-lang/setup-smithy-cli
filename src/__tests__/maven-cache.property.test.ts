import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { computeMavenCacheKeyFromContent } from "../maven-cache.js";

/**
 * Maven cache key determinism and uniqueness
 *
 * For any two maven config objects, OS strings, and arch strings,
 * computeMavenCacheKeyFromContent produces identical keys if and only if
 * the maven content, OS, and architecture are all identical.
 */
describe("Maven cache key determinism and uniqueness", () => {
  /** Arbitrary for a simple maven config object with repositories and dependencies. */
  const mavenContentArb = fc.record({
    repositories: fc.array(
      fc.record({
        url: fc.webUrl(),
        name: fc.string({ minLength: 1, maxLength: 20 }),
      }),
      { minLength: 0, maxLength: 3 }
    ),
    dependencies: fc.array(
      fc.record({
        groupId: fc.stringMatching(/^[a-z][a-z0-9.]{0,19}$/),
        artifactId: fc.stringMatching(/^[a-z][a-z0-9-]{0,19}$/),
        version: fc.stringMatching(/^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$/),
      }),
      { minLength: 0, maxLength: 3 }
    ),
  });

  const osArb = fc.constantFrom("linux", "darwin", "win32");
  const archArb = fc.constantFrom("x64", "arm64");
  const versionArb = fc.stringMatching(/^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$/);

  it("same inputs always produce the same key (determinism)", () => {
    fc.assert(
      fc.property(mavenContentArb, osArb, archArb, versionArb, (maven, osStr, archStr, ver) => {
        const key1 = computeMavenCacheKeyFromContent(maven, osStr, archStr, ver);
        const key2 = computeMavenCacheKeyFromContent(maven, osStr, archStr, ver);
        expect(key1.key).toBe(key2.key);
        expect(key1.restoreKeys).toEqual(key2.restoreKeys);
      }),
      { numRuns: 100 }
    );
  });

  it("keys match iff all inputs match (uniqueness)", () => {
    fc.assert(
      fc.property(
        mavenContentArb,
        mavenContentArb,
        osArb,
        osArb,
        archArb,
        archArb,
        versionArb,
        versionArb,
        (maven1, maven2, os1, os2, arch1, arch2, ver1, ver2) => {
          const result1 = computeMavenCacheKeyFromContent(maven1, os1, arch1, ver1);
          const result2 = computeMavenCacheKeyFromContent(maven2, os2, arch2, ver2);

          const inputsMatch =
            JSON.stringify(maven1) === JSON.stringify(maven2) &&
            os1 === os2 &&
            arch1 === arch2 &&
            ver1 === ver2;

          if (inputsMatch) {
            expect(result1.key).toBe(result2.key);
          } else {
            expect(result1.key).not.toBe(result2.key);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it("key contains the os, arch, and version prefix", () => {
    fc.assert(
      fc.property(mavenContentArb, osArb, archArb, versionArb, (maven, osStr, archStr, ver) => {
        const result = computeMavenCacheKeyFromContent(maven, osStr, archStr, ver);
        const escaped = ver.replace(/\./g, "\\.");
        expect(result.key).toMatch(
          new RegExp(`^smithy-maven-${osStr}-${archStr}-${escaped}-[a-f0-9]{64}$`)
        );
        expect(result.restoreKeys).toEqual([
          `smithy-maven-${osStr}-${archStr}-${ver}-`,
        ]);
      }),
      { numRuns: 100 }
    );
  });
});
