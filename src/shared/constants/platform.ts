function isNightlyBuild(): boolean {
  return isBuildNightly;
}

function isWindowsHost(): boolean {
  return isHostWindows;
}

function isLinuxHost(): boolean {
  return isHostLinux;
}

export { isLinuxHost, isNightlyBuild, isWindowsHost };
