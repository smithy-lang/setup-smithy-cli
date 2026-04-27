import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@actions/core", () => ({
  getInput: vi.fn(),
  addPath: vi.fn(),
  setOutput: vi.fn(),
  setFailed: vi.fn(),
  saveState: vi.fn(),
}));

vi.mock("../version-resolver.js", () => ({
  resolveVersion: vi.fn(),
}));

vi.mock("../archive.js", () => ({
  downloadAndExtract: vi.fn(),
}));

vi.mock("../tool-cache.js", () => ({
  findCached: vi.fn(),
  cacheDir: vi.fn(),
}));

vi.mock("../maven-cache.js", () => ({
  restoreMavenCache: vi.fn(),
}));

import * as core from "@actions/core";
import { resolveVersion } from "../version-resolver.js";
import { downloadAndExtract } from "../archive.js";
import { findCached, cacheDir } from "../tool-cache.js";
import { restoreMavenCache } from "../maven-cache.js";
import { run } from "../setup.js";

describe("setup orchestrator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(restoreMavenCache).mockResolvedValue(false);
    vi.mocked(core.getInput).mockImplementation((name: string) => {
      if (name === "config") return "smithy-build.json";
      return "";
    });
  });

  it("cache hit: resolves version, uses cache, sets PATH/bin and output, no download", async () => {
    vi.mocked(core.getInput).mockImplementation((name: string) => {
      if (name === "version") return "1.50.0";
      if (name === "config") return "smithy-build.json";
      return "";
    });
    vi.mocked(resolveVersion).mockResolvedValue("1.50.0");
    vi.mocked(findCached).mockReturnValue("/cached/smithy-cli/1.50.0");

    await run();

    expect(resolveVersion).toHaveBeenCalledWith("1.50.0", expect.any(String));
    expect(findCached).toHaveBeenCalledWith("1.50.0");
    expect(downloadAndExtract).not.toHaveBeenCalled();
    expect(cacheDir).not.toHaveBeenCalled();
    expect(core.addPath).toHaveBeenCalledWith("/cached/smithy-cli/1.50.0/bin");
    expect(core.setOutput).toHaveBeenCalledWith("cli-version", "1.50.0");
    expect(core.saveState).toHaveBeenCalledWith("cli-version", "1.50.0");
  });

  it("cache miss: resolves version, downloads, caches, sets PATH/bin and output", async () => {
    vi.mocked(core.getInput).mockImplementation((name: string) => {
      if (name === "version") return "1.68.0";
      if (name === "config") return "smithy-build.json";
      return "";
    });
    vi.mocked(resolveVersion).mockResolvedValue("1.68.0");
    vi.mocked(findCached).mockReturnValue("");
    vi.mocked(downloadAndExtract).mockResolvedValue("/tmp/extracted");
    vi.mocked(cacheDir).mockResolvedValue("/cached/smithy-cli/1.68.0");

    await run();

    expect(resolveVersion).toHaveBeenCalledWith("1.68.0", expect.any(String));
    expect(findCached).toHaveBeenCalledWith("1.68.0");
    expect(downloadAndExtract).toHaveBeenCalledWith("1.68.0");
    expect(cacheDir).toHaveBeenCalledWith("/tmp/extracted", "1.68.0");
    expect(core.addPath).toHaveBeenCalledWith("/cached/smithy-cli/1.68.0/bin");
    expect(core.setOutput).toHaveBeenCalledWith("cli-version", "1.68.0");
    expect(core.saveState).toHaveBeenCalledWith("cli-version", "1.68.0");
  });

  it("empty version input passes empty string to resolveVersion", async () => {
    vi.mocked(core.getInput).mockImplementation((name: string) => {
      if (name === "version") return "";
      if (name === "config") return "smithy-build.json";
      return "";
    });
    vi.mocked(resolveVersion).mockResolvedValue("1.70.0");
    vi.mocked(findCached).mockReturnValue("/cached/smithy-cli/1.70.0");

    await run();

    expect(resolveVersion).toHaveBeenCalledWith("", expect.any(String));
  });

  it("sets cli-version output to the resolved version", async () => {
    vi.mocked(core.getInput).mockImplementation((name: string) => {
      if (name === "version") return "";
      if (name === "config") return "smithy-build.json";
      return "";
    });
    vi.mocked(resolveVersion).mockResolvedValue("1.70.0");
    vi.mocked(findCached).mockReturnValue("/cached/path");

    await run();

    expect(core.setOutput).toHaveBeenCalledWith("cli-version", "1.70.0");
  });

  it("passes config input to restoreMavenCache", async () => {
    vi.mocked(core.getInput).mockImplementation((name: string) => {
      if (name === "version") return "1.50.0";
      if (name === "config") return "custom/smithy-build.json";
      return "";
    });
    vi.mocked(resolveVersion).mockResolvedValue("1.50.0");
    vi.mocked(findCached).mockReturnValue("/cached/path");

    await run();

    expect(restoreMavenCache).toHaveBeenCalledWith("custom/smithy-build.json", "1.50.0");
  });

  it("calls restoreMavenCache with default path after setting up CLI", async () => {
    vi.mocked(core.getInput).mockImplementation((name: string) => {
      if (name === "version") return "1.50.0";
      if (name === "config") return "smithy-build.json";
      return "";
    });
    vi.mocked(resolveVersion).mockResolvedValue("1.50.0");
    vi.mocked(findCached).mockReturnValue("/cached/path");

    await run();

    expect(restoreMavenCache).toHaveBeenCalledWith("smithy-build.json", "1.50.0");
  });

  it("calls core.setFailed on unhandled error", async () => {
    vi.mocked(core.getInput).mockImplementation((name: string) => {
      if (name === "version") return "1.50.0";
      if (name === "config") return "smithy-build.json";
      return "";
    });
    vi.mocked(resolveVersion).mockRejectedValue(new Error("Version 99.0.0 not found"));

    await run();

    expect(core.setFailed).toHaveBeenCalledWith("Version 99.0.0 not found");
  });
});
