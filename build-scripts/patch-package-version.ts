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

let packageJson = {};
try {
  console.log(`Reading package.json from ${packageJsonPath}`);
  const packageData = fs.readFileSync(packageJsonPath, "utf8");
  packageJson = JSON.parse(packageData);
} catch (err) {
  console.error("Error reading package.json:", err);
  process.exit(1);
}

packageJson.version = version;

try {
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 4), "utf8");
  console.log(`Updated version in package.json to: ${version}`);
} catch (err) {
  console.error("Error writing to package.json:", err);
  process.exit(1);
}
