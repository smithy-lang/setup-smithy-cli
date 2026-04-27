import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";
import * as core from "@actions/core";
import * as cache from "@actions/cache";

interface MavenCacheKeyInfo {
  key: string;
  restoreKeys: string[];
}

/**
 * Computes a Maven cache key from the given maven content, OS, and arch.
 * Exported for direct testing without filesystem access.
 */
export function computeMavenCacheKeyFromContent(
  mavenContent: unknown,
  osStr: string,
  archStr: string,
  smithyVersion: string
): MavenCacheKeyInfo {
  const hash = crypto
    .createHash("sha256")
    .update(JSON.stringify(mavenContent))
    .digest("hex");
  const key = `smithy-maven-${osStr}-${archStr}-${smithyVersion}-${hash}`;
  const restoreKey = `smithy-maven-${osStr}-${archStr}-${smithyVersion}-`;
  return { key, restoreKeys: [restoreKey] };
}

/**
 * Reads smithy-build.json, extracts the "maven" section, and computes a cache key
 * from its content hash combined with runner OS and architecture.
 * Returns null if smithy-build.json doesn't exist or has no "maven" section.
 */
export function computeMavenCacheKey(smithyBuildPath: string = "smithy-build.json", smithyVersion: string = ""): MavenCacheKeyInfo | null {
  let content: string;
  try {
    content = fs.readFileSync(smithyBuildPath, "utf-8");
  } catch {
    return null;
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }

  if (!parsed.maven) {
    return null;
  }

  return computeMavenCacheKeyFromContent(
    parsed.maven,
    process.platform,
    process.arch,
    smithyVersion
  );
}

const MAVEN_CACHE_PATH = path.join(os.homedir(), ".m2", "repository");

/**
 * Attempts to restore ~/.m2/repository from cache using the computed key.
 * Returns true if cache was restored, false otherwise.
 * Logs a warning and continues if restoration fails.
 */
export async function restoreMavenCache(smithyBuildPath?: string, smithyVersion?: string): Promise<boolean> {
  const keyInfo = computeMavenCacheKey(smithyBuildPath, smithyVersion);
  if (!keyInfo) {
    core.info("No maven section found in smithy-build.json; skipping Maven cache restore.");
    return false;
  }

  try {
    const hitKey = await cache.restoreCache(
      [MAVEN_CACHE_PATH],
      keyInfo.key,
      keyInfo.restoreKeys
    );
    if (hitKey) {
      core.info(`Maven cache restored from key: ${hitKey}`);
      return true;
    }
    core.info("Maven cache not found; dependencies will be downloaded.");
    return false;
  } catch (error) {
    core.warning(`Failed to restore Maven cache: ${(error as Error).message}`);
    return false;
  }
}

/**
 * Saves ~/.m2/repository to cache using the computed key.
 * Logs a warning and continues if saving fails. Called from post.js.
 */
export async function saveMavenCache(smithyBuildPath?: string, smithyVersion?: string): Promise<void> {
  const keyInfo = computeMavenCacheKey(smithyBuildPath, smithyVersion);
  if (!keyInfo) {
    core.info("No maven section found in smithy-build.json; skipping Maven cache save.");
    return;
  }

  try {
    await cache.saveCache([MAVEN_CACHE_PATH], keyInfo.key);
    core.info(`Maven cache saved with key: ${keyInfo.key}`);
  } catch (error) {
    core.warning(`Failed to save Maven cache: ${(error as Error).message}`);
  }
}
