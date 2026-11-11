import fs from "node:fs";
import path from "node:path";

const rootDir = path.join(import.meta.dirname, "..");
const versionFilePath = path.resolve(rootDir, "Version");
const packageJsonPath = path.resolve(rootDir, "package.json");

let version = "";
try {
  console.log(`Reading Version from ${versionFilePath}`);
  version = fs.readFileSync(versionFilePath, "utf8").trim();
  const index = version.indexOf("T");
  if (index > 0) {
    version = version.substring(0, index).replaceAll("-", ".");
  }
  if (!version || version === "Nightly Build") {
    version = new Date().toISOString().slice(0, 10).replaceAll("-", ".");
  }
} catch (err) {
  console.error("Error reading Version file:", err);
  process.exit(1);
}

let packageJson: Record<string, unknown>;
try {
  console.log(`Reading package.json from ${packageJsonPath}`);
  const packageData = fs.readFileSync(packageJsonPath, "utf8");
  const parsed: unknown = JSON.parse(packageData);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${packageJsonPath} must contain a JSON object`);
  }
  packageJson = Object.fromEntries(Object.entries(parsed));
} catch (err) {
  console.error("Error reading package.json:", err);
  process.exit(1);
}

packageJson["version"] = version;

try {
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 4), "utf8");
  console.log(`Updated version in package.json to: ${version}`);
} catch (err) {
  console.error("Error writing to package.json:", err);
  process.exit(1);
}
