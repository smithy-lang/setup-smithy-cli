import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@actions/tool-cache", () => ({
  find: vi.fn(),
  cacheDir: vi.fn(),
}));

import * as tc from "@actions/tool-cache";
import { findCached, cacheDir } from "../tool-cache.js";

describe("findCached", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the cached path on cache hit", () => {
    vi.mocked(tc.find).mockReturnValue("/opt/hostedtoolcache/smithy-cli/1.50.0/x64");

    const result = findCached("1.50.0");

    expect(tc.find).toHaveBeenCalledWith("smithy-cli", "1.50.0");
    expect(result).toBe("/opt/hostedtoolcache/smithy-cli/1.50.0/x64");
  });

  it("returns empty string on cache miss", () => {
    vi.mocked(tc.find).mockReturnValue("");

    const result = findCached("1.50.0");

    expect(tc.find).toHaveBeenCalledWith("smithy-cli", "1.50.0");
    expect(result).toBe("");
  });
});

describe("cacheDir", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls tc.cacheDir with tool name 'smithy-cli' and the given version", async () => {
    vi.mocked(tc.cacheDir).mockResolvedValue("/opt/hostedtoolcache/smithy-cli/1.68.0/x64");

    const result = await cacheDir("/tmp/extracted", "1.68.0");

    expect(tc.cacheDir).toHaveBeenCalledWith("/tmp/extracted", "smithy-cli", "1.68.0");
    expect(result).toBe("/opt/hostedtoolcache/smithy-cli/1.68.0/x64");
  });
});
