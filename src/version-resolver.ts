import * as github from "@actions/github";

const OWNER = "smithy-lang";
const REPO = "smithy";

/**
 * Resolves the Smithy CLI version to install.
 * If versionSpec is empty or undefined, fetches the latest release tag from GitHub.
 * Validates that the resolved version corresponds to an actual release.
 * Returns the resolved version string (without leading 'v' prefix).
 * Throws if the version does not match any published release.
 */
export async function resolveVersion(
  versionSpec: string | undefined,
  token?: string
): Promise<string> {
  const octokit = github.getOctokit(token ?? process.env.GITHUB_TOKEN ?? "");

  const normalized = versionSpec?.trim() ?? "";

  if (normalized === "") {
    const { data } = await octokit.rest.repos.getLatestRelease({
      owner: OWNER,
      repo: REPO,
    });
    return data.tag_name.replace(/^v/, "");
  }

  const version = normalized.replace(/^v/, "");

  try {
    await octokit.rest.repos.getReleaseByTag({
      owner: OWNER,
      repo: REPO,
      tag: version,
    });
    return version;
  } catch (error: unknown) {
    const status = (error as { status?: number }).status;
    if (status === 404) {
      throw new Error(
        `Version ${version} not found. No matching release exists for "${version}" in ${OWNER}/${REPO}.`
      );
    }
    throw error;
  }
}
