import * as fs from "fs";
import * as path from "path";
import * as semver from "semver";
import * as tc from "@actions/tool-cache";

const ZIP_THRESHOLD = "1.47.0";

/**
 * Returns the archive format for a given Smithy CLI version.
 * Versions >= 1.47.0 use zip; earlier versions use tar.gz.
 */
export function getArchiveFormat(version: string): "zip" | "tar.gz" {
  return semver.gte(version, ZIP_THRESHOLD) ? "zip" : "tar.gz";
}

/** Platform identifiers used in Smithy release asset names. */
interface SmithyPlatform {
  os: string;
  arch: string;
}

const PLATFORM_MAP: Record<string, Record<string, SmithyPlatform>> = {
  linux: {
    arm64: { os: "linux", arch: "aarch64" },
    x64: { os: "linux", arch: "x86_64" },
  },
  darwin: {
    arm64: { os: "darwin", arch: "aarch64" },
    x64: { os: "darwin", arch: "x86_64" },
  },
  win32: {
    x64: { os: "windows", arch: "x64" },
  },
};

/**
 * Maps the current process.platform and process.arch to Smithy release identifiers.
 * Throws for unsupported platform/arch combinations.
 */
export function resolveSmithyPlatform(): SmithyPlatform {
  const platformEntry = PLATFORM_MAP[process.platform];
  if (!platformEntry) {
    throw new Error(`Unsupported platform: ${process.platform}`);
  }
  const result = platformEntry[process.arch];
  if (!result) {
    throw new Error(
      `Unsupported platform/architecture combination: ${process.platform}/${process.arch}`
    );
  }
  return result;
}

/**
 * Constructs the GitHub Releases download URL for a Smithy CLI version.
 */
export function getDownloadUrl(
  version: string,
  format: "zip" | "tar.gz"
): string {
  const { os, arch } = resolveSmithyPlatform();
  return `https://github.com/smithy-lang/smithy/releases/download/${version}/smithy-cli-${os}-${arch}.${format}`;
}

/**
 * Downloads and extracts the Smithy CLI archive for the given version.
 * Returns the path to the extracted directory.
 */
export async function downloadAndExtract(version: string): Promise<string> {
  const format = getArchiveFormat(version);
  const url = getDownloadUrl(version, format);

  let archivePath: string;
  try {
    archivePath = await tc.downloadTool(url);
  } catch (error) {
    throw new Error(
      `Failed to download Smithy CLI from ${url}: ${(error as Error).message}`
    );
  }

  let extractedPath: string;
  try {
    if (format === "zip") {
      extractedPath = await tc.extractZip(archivePath);
    } else {
      extractedPath = await tc.extractTar(archivePath);
    }
  } catch (error) {
    throw new Error(
      `Failed to extract Smithy CLI archive: ${(error as Error).message}`
    );
  }

  // If the archive contains a single top-level directory, descend into it
  const entries = fs.readdirSync(extractedPath);
  if (entries.length === 1) {
    const single = path.join(extractedPath, entries[0]);
    if (fs.statSync(single).isDirectory()) {
      return single;
    }
  }
  return extractedPath;
}
