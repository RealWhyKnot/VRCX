const REGION_KEYS: Partial<Record<string, string>> = {
  us: "dialog.new_instance.region_usw",
  usw: "dialog.new_instance.region_usw",
  use: "dialog.new_instance.region_use",
  eu: "dialog.new_instance.region_eu",
  jp: "dialog.new_instance.region_jp",
};

function regionName(region: string, t: (key: string) => string): string {
  const key = REGION_KEYS[region];
  return key ? t(key) : region.toUpperCase();
}

export { regionName };
