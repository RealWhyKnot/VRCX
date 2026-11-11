export function getArchAndPlatform() {
  const args = process.argv.slice(2);
  let arch = process.arch.toString();
  let platform = process.platform.toString();
  for (const argument of args) {
    if (argument.startsWith("--arch=")) {
      arch = argument.slice(7).split("=")[0] ?? "";
    }
    if (argument.startsWith("--platform=")) {
      platform = argument.slice(11).split("=")[0] ?? "";
    }
  }
  console.log(`Using arch: ${arch}, platform: ${platform}`);
  return { arch, platform };
}
