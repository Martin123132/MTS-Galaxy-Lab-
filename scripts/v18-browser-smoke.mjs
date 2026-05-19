import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifactPath = path.join(root, "data", "v18-01-review-candidate.js");
const indexPath = path.join(root, "index.html");
const appPath = path.join(root, "app.js");

function fail(message) {
  console.error(`v18 browser smoke failed: ${message}`);
  process.exit(1);
}

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (err) {
    fail(`cannot read ${filePath}: ${err.message}`);
  }
}

const artifactSource = readText(artifactPath);
const context = { window: {} };
try {
  vm.runInNewContext(artifactSource, context, { filename: artifactPath });
} catch (err) {
  fail(`artifact does not execute as browser data: ${err.message}`);
}

const artifact = context.window.MTS_V18_01_REVIEW_CANDIDATE;
if (!artifact || !artifact.metadata || !artifact.curves) fail("MTS_V18_01_REVIEW_CANDIDATE missing metadata or curves");
if (artifact.metadata.curveCount !== 175) fail(`expected 175 artifact curves, found ${artifact.metadata.curveCount}`);
if (artifact.metadata.cleanCurveCount !== 160) fail(`expected 160 clean curves, found ${artifact.metadata.cleanCurveCount}`);
if (artifact.metadata.weakSystematicsExcludedCount !== 15) {
  fail(`expected 15 weak/systematics exclusions, found ${artifact.metadata.weakSystematicsExcludedCount}`);
}
if (artifact.metadata.reviewGate?.verdict !== "v18 candidate ready for review") {
  fail(`unexpected review verdict ${artifact.metadata.reviewGate?.verdict}`);
}
if (artifact.metadata.reviewGate.stressAbove20 !== 0) fail("stressAbove20 is not zero");
if (artifact.metadata.reviewGate.activeProtectedWorseCount !== 0) fail("activeProtectedWorseCount is not zero");
if (!Number.isFinite(artifact.metadata.reviewGate.nullMarginKmS) || artifact.metadata.reviewGate.nullMarginKmS < 10) {
  fail(`null margin too small: ${artifact.metadata.reviewGate.nullMarginKmS}`);
}
if (artifact.metadata.lawNativeVerification) {
  if (artifact.metadata.lawNativeVerification.verdict !== "v18 law-native verified") {
    fail(`unexpected law-native verdict ${artifact.metadata.lawNativeVerification.verdict}`);
  }
  if (artifact.metadata.lawNativeVerification.cleanParityMismatchCount !== 0) {
    fail(`law-native parity mismatches ${artifact.metadata.lawNativeVerification.cleanParityMismatchCount}`);
  }
}

const indexHtml = readText(indexPath);
const appJs = readText(appPath);
if (!indexHtml.includes("data/v18-01-review-candidate.js")) fail("index.html does not load the v18 artifact");
if (!indexHtml.includes('<option value="v18review">MTS v18.01 review candidate</option>')) {
  fail("index.html is missing the v18 framework preset option");
}
if (!appJs.includes("window.MTS_V18_01_REVIEW_CANDIDATE")) fail("app.js does not read the v18 artifact");
if (!appJs.includes("v17ExactCacheEntry(curve, compiled)")) fail("app.js is not passing compiled preset state into exact-cache lookup");
if (!appJs.includes("generated v18.01 artifact")) fail("app.js v18 panel does not describe the generated artifact");
if (!appJs.includes("v18ReviewArtifactCount")) fail("app.js does not populate v18 artifact count");
if (!indexHtml.includes("v18ReviewArtifactCount")) fail("index.html does not expose v18 artifact count");
if (!appJs.includes("v18ReviewLawNative")) fail("app.js does not populate v18 law-native status");
if (!indexHtml.includes("v18ReviewLawNative")) fail("index.html does not expose v18 law-native status");

console.log(
  [
    "v18_browser_smoke=pass",
    `curves=${artifact.metadata.curveCount}`,
    `clean=${artifact.metadata.cleanCurveCount}`,
    `weakExcluded=${artifact.metadata.weakSystematicsExcludedCount}`,
    `verdict=${artifact.metadata.reviewGate.verdict}`,
  ].join("\t"),
);
