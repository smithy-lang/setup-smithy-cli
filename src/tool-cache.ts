import * as tc from "@actions/tool-cache";

const TOOL_NAME = "smithy-cli";

/**
 * Checks if the given Smithy CLI version is already in the runner tool cache.
 * Returns the cached path if found, or an empty string if not.
 */
export function findCached(version: string): string {
  return tc.find(TOOL_NAME, version);
}

/**
 * Caches the extracted Smithy CLI directory under tool name "smithy-cli".
 * Returns the path to the cached directory.
 */
export async function cacheDir(
  extractedPath: string,
  version: string
): Promise<string> {
  return tc.cacheDir(extractedPath, TOOL_NAME, version);
}
