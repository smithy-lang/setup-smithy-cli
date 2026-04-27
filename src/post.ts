import * as core from "@actions/core";
import { saveMavenCache } from "./maven-cache.js";

const smithyBuildPath = core.getInput("config") || "smithy-build.json";
const smithyVersion = core.getState("cli-version") || "";
saveMavenCache(smithyBuildPath, smithyVersion).catch((e) =>
  core.warning(`Unexpected post error: ${(e as Error).message}`)
);
