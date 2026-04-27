import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@actions/tool-cache", () => ({
  downloadTool: vi.fn(),
  extractZip: vi.fn(),
  extractTar: vi.fn(),
}));

vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return {
    ...actual,
    readdirSync: vi.fn(),
    statSync: vi.fn(),
  };
});

import * as fs from "fs";
import * as tc from "@actions/tool-cache";
import {
  getArchiveFormat,
  resolveSmithyPlatform,
  getDownloadUrl,
  downloadAndExtract,
} from "../archive.js";

describe("resolveSmithyPlatform", () => {
  const originalPlatform = process.platform;
  const originalArch = process.arch;

  afterEach(() => {
    Object.defineProperty(process, "platform", { value: originalPlatform, configurable: true });
    Object.defineProperty(process, "arch", { value: originalArch, configurable: true });
  });

  const cases: Array<{
    platform: string;
    arch: string;
    expectedOs: string;
    expectedArch: string;
  }> = [
    { platform: "linux", arch: "x64", expectedOs: "linux", expectedArch: "x86_64" },
    { platform: "linux", arch: "arm64", expectedOs: "linux", expectedArch: "aarch64" },
    { platform: "darwin", arch: "x64", expectedOs: "darwin", expectedArch: "x86_64" },
    { platform: "darwin", arch: "arm64", expectedOs: "darwin", expectedArch: "aarch64" },
    { platform: "win32", arch: "x64", expectedOs: "windows", expectedArch: "x64" },
  ];

  it.each(cases)(
    "maps $platform/$arch to $expectedOs/$expectedArch",
    ({ platform, arch, expectedOs, expectedArch }) => {
      Object.defineProperty(process, "platform", { value: platform, configurable: true });
      Object.defineProperty(process, "arch", { value: arch, configurable: true });

      const result = resolveSmithyPlatform();
      expect(result).toEqual({ os: expectedOs, arch: expectedArch });
    }
  );

  it("throws for win32/arm64 (unsupported)", () => {
    Object.defineProperty(process, "platform", { value: "win32", configurable: true });
    Object.defineProperty(process, "arch", { value: "arm64", configurable: true });

    expect(() => resolveSmithyPlatform()).toThrow(/unsupported/i);
  });
});

describe("downloadAndExtract", () => {
  const originalPlatform = process.platform;
  const originalArch = process.arch;

  beforeEach(() => {
    vi.clearAllMocks();
    // Set a known platform for predictable URLs
    Object.defineProperty(process, "platform", { value: "linux", configurable: true });
    Object.defineProperty(process, "arch", { value: "x64", configurable: true });
  });

  afterEach(() => {
    Object.defineProperty(process, "platform", { value: originalPlatform, configurable: true });
    Object.defineProperty(process, "arch", { value: originalArch, configurable: true });
  });

  it("calls extractZip for zip format (version >= 1.47.0) and descends into single directory", async () => {
    vi.mocked(tc.downloadTool).mockResolvedValue("/tmp/archive.zip");
    vi.mocked(tc.extractZip).mockResolvedValue("/tmp/extracted");
    vi.mocked(fs.readdirSync).mockReturnValue(["smithy-cli-1.50.0"] as unknown as ReturnType<typeof fs.readdirSync>);
    vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as fs.Stats);

    const result = await downloadAndExtract("1.50.0");

    expect(tc.downloadTool).toHaveBeenCalledOnce();
    expect(tc.extractZip).toHaveBeenCalledWith("/tmp/archive.zip");
    expect(tc.extractTar).not.toHaveBeenCalled();
    expect(result).toBe("/tmp/extracted/smithy-cli-1.50.0");
  });

  it("calls extractTar for tar.gz format (version < 1.47.0) and descends into single directory", async () => {
    vi.mocked(tc.downloadTool).mockResolvedValue("/tmp/archive.tar.gz");
    vi.mocked(tc.extractTar).mockResolvedValue("/tmp/extracted");
    vi.mocked(fs.readdirSync).mockReturnValue(["smithy-cli-1.46.0"] as unknown as ReturnType<typeof fs.readdirSync>);
    vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as fs.Stats);

    const result = await downloadAndExtract("1.46.0");

    expect(tc.downloadTool).toHaveBeenCalledOnce();
    expect(tc.extractTar).toHaveBeenCalledWith("/tmp/archive.tar.gz");
    expect(tc.extractZip).not.toHaveBeenCalled();
    expect(result).toBe("/tmp/extracted/smithy-cli-1.46.0");
  });

  it("returns extractedPath directly when multiple entries exist", async () => {
    vi.mocked(tc.downloadTool).mockResolvedValue("/tmp/archive.zip");
    vi.mocked(tc.extractZip).mockResolvedValue("/tmp/extracted");
    vi.mocked(fs.readdirSync).mockReturnValue(["bin", "lib"] as unknown as ReturnType<typeof fs.readdirSync>);

    const result = await downloadAndExtract("1.50.0");

    expect(result).toBe("/tmp/extracted");
  });

  it("returns extractedPath when single entry is a file, not a directory", async () => {
    vi.mocked(tc.downloadTool).mockResolvedValue("/tmp/archive.zip");
    vi.mocked(tc.extractZip).mockResolvedValue("/tmp/extracted");
    vi.mocked(fs.readdirSync).mockReturnValue(["smithy"] as unknown as ReturnType<typeof fs.readdirSync>);
    vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => false } as fs.Stats);

    const result = await downloadAndExtract("1.50.0");

    expect(result).toBe("/tmp/extracted");
  });

  it("includes the attempted URL in download failure error", async () => {
    vi.mocked(tc.downloadTool).mockRejectedValue(new Error("Network error"));

    await expect(downloadAndExtract("1.50.0")).rejects.toThrow(
      /Failed to download Smithy CLI from https:\/\/github\.com\/smithy-lang\/smithy\/releases\/download\/1\.50\.0\/smithy-cli-linux-x86_64\.zip/
    );
  });
});
