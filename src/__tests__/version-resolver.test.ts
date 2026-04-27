import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@actions/github", () => ({
  getOctokit: vi.fn(),
}));

import * as github from "@actions/github";
import { resolveVersion } from "../version-resolver.js";

function createMockOctokit(overrides: {
  getLatestRelease?: () => Promise<unknown>;
  getReleaseByTag?: (params: { owner: string; repo: string; tag: string }) => Promise<unknown>;
}) {
  return {
    rest: {
      repos: {
        getLatestRelease: overrides.getLatestRelease ?? vi.fn(),
        getReleaseByTag: overrides.getReleaseByTag ?? vi.fn(),
      },
    },
  };
}

describe("resolveVersion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls latest release endpoint when input is empty", async () => {
    const getLatestRelease = vi.fn().mockResolvedValue({
      data: { tag_name: "1.50.0" },
    });
    vi.mocked(github.getOctokit).mockReturnValue(
      createMockOctokit({ getLatestRelease }) as ReturnType<typeof github.getOctokit>
    );

    const result = await resolveVersion("", "fake-token");

    expect(getLatestRelease).toHaveBeenCalledWith({
      owner: "smithy-lang",
      repo: "smithy",
    });
    expect(result).toBe("1.50.0");
  });

  it("calls latest release endpoint when input is undefined", async () => {
    const getLatestRelease = vi.fn().mockResolvedValue({
      data: { tag_name: "1.50.0" },
    });
    vi.mocked(github.getOctokit).mockReturnValue(
      createMockOctokit({ getLatestRelease }) as ReturnType<typeof github.getOctokit>
    );

    const result = await resolveVersion(undefined, "fake-token");

    expect(getLatestRelease).toHaveBeenCalled();
    expect(result).toBe("1.50.0");
  });

  it("returns normalized version for a valid version string", async () => {
    const getReleaseByTag = vi.fn().mockResolvedValue({
      data: { tag_name: "1.48.0" },
    });
    vi.mocked(github.getOctokit).mockReturnValue(
      createMockOctokit({ getReleaseByTag }) as ReturnType<typeof github.getOctokit>
    );

    const result = await resolveVersion("1.48.0", "fake-token");

    expect(getReleaseByTag).toHaveBeenCalledWith({
      owner: "smithy-lang",
      repo: "smithy",
      tag: "1.48.0",
    });
    expect(result).toBe("1.48.0");
  });

  it("strips leading v prefix from input", async () => {
    const getReleaseByTag = vi.fn().mockResolvedValue({
      data: { tag_name: "1.48.0" },
    });
    vi.mocked(github.getOctokit).mockReturnValue(
      createMockOctokit({ getReleaseByTag }) as ReturnType<typeof github.getOctokit>
    );

    const result = await resolveVersion("v1.48.0", "fake-token");

    expect(getReleaseByTag).toHaveBeenCalledWith({
      owner: "smithy-lang",
      repo: "smithy",
      tag: "1.48.0",
    });
    expect(result).toBe("1.48.0");
  });

  it("throws with version in error message for non-existent version", async () => {
    const error = new Error("Not Found") as Error & { status: number };
    error.status = 404;
    const getReleaseByTag = vi.fn().mockRejectedValue(error);
    vi.mocked(github.getOctokit).mockReturnValue(
      createMockOctokit({ getReleaseByTag }) as ReturnType<typeof github.getOctokit>
    );

    await expect(resolveVersion("99.99.99", "fake-token")).rejects.toThrow("99.99.99");
  });

  it("strips v prefix from latest release tag_name", async () => {
    const getLatestRelease = vi.fn().mockResolvedValue({
      data: { tag_name: "v1.51.0" },
    });
    vi.mocked(github.getOctokit).mockReturnValue(
      createMockOctokit({ getLatestRelease }) as ReturnType<typeof github.getOctokit>
    );

    const result = await resolveVersion("", "fake-token");
    expect(result).toBe("1.51.0");
  });
});
