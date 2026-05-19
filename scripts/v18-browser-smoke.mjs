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
if (artifact.metadata.branchPrune) {
  if (!String(artifact.metadata.branchPrune.verdict || "").includes("v18 branch")) {
    fail(`unexpected branch-prune verdict ${artifact.metadata.branchPrune.verdict}`);
  }
  if (artifact.metadata.branchPrune.minimalHighAbove20 !== 0) {
    fail(`branch-prune minimal above-20 count ${artifact.metadata.branchPrune.minimalHighAbove20}`);
  }
}
if (artifact.metadata.familyAudit) {
  if (!String(artifact.metadata.familyAudit.verdict || "").includes("v18 family")) {
    fail(`unexpected family-audit verdict ${artifact.metadata.familyAudit.verdict}`);
  }
  if (artifact.metadata.familyAudit.weakSystematicsLeakage !== 0) {
    fail(`family-audit weak/systematics leakage ${artifact.metadata.familyAudit.weakSystematicsLeakage}`);
  }
  if (!Number.isInteger(artifact.metadata.familyAudit.familyCount) || artifact.metadata.familyAudit.familyCount < 1) {
    fail(`invalid v18 family count ${artifact.metadata.familyAudit.familyCount}`);
  }
}
if (artifact.metadata.branchIdentity) {
  if (!String(artifact.metadata.branchIdentity.verdict || "").includes("v18 branch identity")) {
    fail(`unexpected branch-identity verdict ${artifact.metadata.branchIdentity.verdict}`);
  }
  if (artifact.metadata.branchIdentity.weakSystematicsLeakage !== 0) {
    fail(`branch-identity weak/systematics leakage ${artifact.metadata.branchIdentity.weakSystematicsLeakage}`);
  }
  if (!Number.isInteger(artifact.metadata.branchIdentity.branchCount) || artifact.metadata.branchIdentity.branchCount < 1) {
    fail(`invalid v18 branch-identity count ${artifact.metadata.branchIdentity.branchCount}`);
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
if (!appJs.includes("v18ReviewBranchPrune")) fail("app.js does not populate v18 branch-prune status");
if (!indexHtml.includes("v18ReviewBranchPrune")) fail("index.html does not expose v18 branch-prune status");
if (!appJs.includes("v18ReviewFamilyAudit")) fail("app.js does not populate v18 family-audit status");
if (!indexHtml.includes("v18ReviewFamilyAudit")) fail("index.html does not expose v18 family-audit status");
if (!appJs.includes("v18ReviewBranchIdentity")) fail("app.js does not populate v18 branch-identity status");
if (!indexHtml.includes("v18ReviewBranchIdentity")) fail("index.html does not expose v18 branch-identity status");

console.log(
  [
    "v18_browser_smoke=pass",
    `curves=${artifact.metadata.curveCount}`,
    `clean=${artifact.metadata.cleanCurveCount}`,
    `weakExcluded=${artifact.metadata.weakSystematicsExcludedCount}`,
    `verdict=${artifact.metadata.reviewGate.verdict}`,
  ].join("\t"),
);
