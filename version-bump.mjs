import { readFileSync, writeFileSync } from "fs";

const targetVersion = process.env.npm_package_version || process.argv[2];

if (!targetVersion) {
  console.error("No version specified");
  process.exit(1);
}

// Read manifest
const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const { minAppVersion } = manifest;
manifest.version = targetVersion;
writeFileSync("manifest.json", JSON.stringify(manifest, null, 2) + "\n");

// Update versions.json
let versions = {};
try {
  versions = JSON.parse(readFileSync("versions.json", "utf8"));
} catch (e) {
  // File might not exist yet
}
versions[targetVersion] = minAppVersion;
writeFileSync("versions.json", JSON.stringify(versions, null, 2) + "\n");

console.log(`Version bumped to ${targetVersion}`);
