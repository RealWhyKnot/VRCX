export function getArchAndPlatform(): { arch: string; platform: string } {
  const args = process.argv.slice(2);
  let arch: string = process.arch;
  let platform: string = process.platform;
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
