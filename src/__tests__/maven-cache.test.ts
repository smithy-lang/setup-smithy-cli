import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@actions/cache", () => ({
  restoreCache: vi.fn(),
  saveCache: vi.fn(),
}));

vi.mock("@actions/core", () => ({
  info: vi.fn(),
  warning: vi.fn(),
}));

vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return {
    ...actual,
    readFileSync: vi.fn(),
  };
});

import * as fs from "fs";
import * as cache from "@actions/cache";
import * as core from "@actions/core";
import {
  computeMavenCacheKey,
  restoreMavenCache,
  saveMavenCache,
} from "../maven-cache.js";

const SMITHY_BUILD_WITH_MAVEN = JSON.stringify({
  version: "1.0",
  maven: {
    repositories: [{ url: "https://repo.example.com" }],
    dependencies: ["com.example:lib:1.0.0"],
  },
});

const SMITHY_BUILD_NO_MAVEN = JSON.stringify({
  version: "1.0",
  sources: ["model"],
});

const SMITHY_BUILD_DIFFERENT_MAVEN = JSON.stringify({
  version: "1.0",
  maven: {
    repositories: [{ url: "https://repo.example.com" }],
    dependencies: ["com.example:lib:2.0.0"],
  },
});

describe("computeMavenCacheKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a key when smithy-build.json has a maven section", () => {
    vi.mocked(fs.readFileSync).mockReturnValue(SMITHY_BUILD_WITH_MAVEN);

    const result = computeMavenCacheKey();

    expect(result).not.toBeNull();
    expect(result!.key).toMatch(/^smithy-maven-.+-.+-.*-[a-f0-9]{64}$/);
    expect(result!.restoreKeys).toHaveLength(1);
    expect(result!.restoreKeys[0]).toMatch(/^smithy-maven-.+-.+-.*-$/);
  });

  it("returns null when smithy-build.json is absent", () => {
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error("ENOENT: no such file or directory");
    });

    const result = computeMavenCacheKey();
    expect(result).toBeNull();
  });

  it("returns null when smithy-build.json has no maven section", () => {
    vi.mocked(fs.readFileSync).mockReturnValue(SMITHY_BUILD_NO_MAVEN);

    const result = computeMavenCacheKey();
    expect(result).toBeNull();
  });

  it("produces a different key when maven content changes", () => {
    vi.mocked(fs.readFileSync).mockReturnValue(SMITHY_BUILD_WITH_MAVEN);
    const key1 = computeMavenCacheKey()!.key;

    vi.mocked(fs.readFileSync).mockReturnValue(SMITHY_BUILD_DIFFERENT_MAVEN);
    const key2 = computeMavenCacheKey()!.key;

    expect(key1).not.toBe(key2);
  });

  it("reads from a custom path when provided", () => {
    vi.mocked(fs.readFileSync).mockReturnValue(SMITHY_BUILD_WITH_MAVEN);

    const result = computeMavenCacheKey("custom/smithy-build.json", "1.50.0");

    expect(result).not.toBeNull();
    expect(fs.readFileSync).toHaveBeenCalledWith("custom/smithy-build.json", "utf-8");
  });
});

describe("restoreMavenCache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("attempts cache restore when smithy-build.json has maven section", async () => {
    vi.mocked(fs.readFileSync).mockReturnValue(SMITHY_BUILD_WITH_MAVEN);
    vi.mocked(cache.restoreCache).mockResolvedValue("smithy-maven-hit-key");

    const result = await restoreMavenCache();

    expect(result).toBe(true);
    expect(cache.restoreCache).toHaveBeenCalledOnce();
    expect(cache.restoreCache).toHaveBeenCalledWith(
      expect.arrayContaining([expect.stringContaining(".m2")]),
      expect.stringMatching(/^smithy-maven-/),
      expect.arrayContaining([expect.stringMatching(/^smithy-maven-/)])
    );
  });

  it("returns false when cache is not found", async () => {
    vi.mocked(fs.readFileSync).mockReturnValue(SMITHY_BUILD_WITH_MAVEN);
    vi.mocked(cache.restoreCache).mockResolvedValue(undefined);

    const result = await restoreMavenCache();

    expect(result).toBe(false);
  });

  it("skips restore when smithy-build.json is absent", async () => {
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error("ENOENT");
    });

    const result = await restoreMavenCache();

    expect(result).toBe(false);
    expect(cache.restoreCache).not.toHaveBeenCalled();
  });

  it("skips restore when no maven section exists", async () => {
    vi.mocked(fs.readFileSync).mockReturnValue(SMITHY_BUILD_NO_MAVEN);

    const result = await restoreMavenCache();

    expect(result).toBe(false);
    expect(cache.restoreCache).not.toHaveBeenCalled();
  });

  it("logs warning and returns false on cache restore error", async () => {
    vi.mocked(fs.readFileSync).mockReturnValue(SMITHY_BUILD_WITH_MAVEN);
    vi.mocked(cache.restoreCache).mockRejectedValue(new Error("Cache service unavailable"));

    const result = await restoreMavenCache();

    expect(result).toBe(false);
    expect(core.warning).toHaveBeenCalledWith(
      expect.stringContaining("Cache service unavailable")
    );
  });

  it("passes custom path through to computeMavenCacheKey", async () => {
    vi.mocked(fs.readFileSync).mockReturnValue(SMITHY_BUILD_WITH_MAVEN);
    vi.mocked(cache.restoreCache).mockResolvedValue("smithy-maven-hit-key");

    await restoreMavenCache("custom/smithy-build.json", "1.50.0");

    expect(fs.readFileSync).toHaveBeenCalledWith("custom/smithy-build.json", "utf-8");
  });
});

describe("saveMavenCache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("saves cache when smithy-build.json has maven section", async () => {
    vi.mocked(fs.readFileSync).mockReturnValue(SMITHY_BUILD_WITH_MAVEN);
    vi.mocked(cache.saveCache).mockResolvedValue(42);

    await saveMavenCache();

    expect(cache.saveCache).toHaveBeenCalledOnce();
    expect(cache.saveCache).toHaveBeenCalledWith(
      expect.arrayContaining([expect.stringContaining(".m2")]),
      expect.stringMatching(/^smithy-maven-/)
    );
  });

  it("skips save when smithy-build.json is absent", async () => {
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error("ENOENT");
    });

    await saveMavenCache();

    expect(cache.saveCache).not.toHaveBeenCalled();
  });

  it("logs warning on cache save error", async () => {
    vi.mocked(fs.readFileSync).mockReturnValue(SMITHY_BUILD_WITH_MAVEN);
    vi.mocked(cache.saveCache).mockRejectedValue(new Error("Quota exceeded"));

    await saveMavenCache();

    expect(core.warning).toHaveBeenCalledWith(
      expect.stringContaining("Quota exceeded")
    );
  });

  it("passes custom path through to computeMavenCacheKey", async () => {
    vi.mocked(fs.readFileSync).mockReturnValue(SMITHY_BUILD_WITH_MAVEN);
    vi.mocked(cache.saveCache).mockResolvedValue(42);

    await saveMavenCache("custom/smithy-build.json", "1.50.0");

    expect(fs.readFileSync).toHaveBeenCalledWith("custom/smithy-build.json", "utf-8");
  });
});
