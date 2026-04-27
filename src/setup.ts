import * as path from "path";
import * as core from "@actions/core";
import { resolveVersion } from "./version-resolver.js";
import { downloadAndExtract } from "./archive.js";
import { findCached, cacheDir } from "./tool-cache.js";
import { restoreMavenCache } from "./maven-cache.js";

/**
 * Main orchestrator. Reads inputs, resolves version, checks cache,
 * downloads/extracts on miss, adds CLI to PATH, sets outputs,
 * and restores Maven cache.
 */
export async function run(): Promise<void> {
  try {
    const versionSpec = core.getInput("version");
    const token = process.env.GITHUB_TOKEN || "";

    const version = await resolveVersion(versionSpec, token);

    let cachedPath = findCached(version);

    if (!cachedPath) {
      const extractedPath = await downloadAndExtract(version);
      cachedPath = await cacheDir(extractedPath, version);
    }

    core.addPath(path.join(cachedPath, "bin"));
    core.setOutput("cli-version", version);
    core.saveState("cli-version", version);

    const smithyBuildPath = core.getInput("config") || "smithy-build.json";
    await restoreMavenCache(smithyBuildPath, version);
  } catch (error) {
    core.setFailed((error as Error).message);
  }
}
