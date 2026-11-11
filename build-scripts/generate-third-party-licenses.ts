import fs from "node:fs";
import os from "node:os";
import path from "node:path";

type SourceType = "frontend" | "dotnet" | "native";

type LicenseNotice = {
  license: string;
  licenseUrl: string;
  projectUrl: string;
  noticeText: string;
};

type ComponentEntry = {
  name: string;
  version: string;
  sourceType: SourceType;
  filePath?: string;
};

type MergedComponentEntry = ComponentEntry & {
  projects: string[];
};

type ReportedEntry = MergedComponentEntry &
  LicenseNotice & {
    id: string;
    sourceLabel: string;
    needsReview: boolean;
  };

type FrontendEntry = {
  id: string;
  name: string;
  version: string;
  license: string;
  sourceType: "frontend";
  sourceLabel: string;
  noticeText: string;
  needsReview: boolean;
};

const rootDir = path.join(import.meta.dirname, "..");
const frontendLicensePath = path.join(rootDir, "build", "html", ".vite", "license.md");
const outputDir = path.join(rootDir, "build", "html", "licenses");
const outputManifestPath = path.join(outputDir, "third-party-licenses.json");
const outputNoticePath = path.join(outputDir, "THIRD_PARTY_NOTICES.txt");
const dotnetDir = path.join(rootDir, "Dotnet");
const nugetPackagesEnv = process.env["NUGET_PACKAGES"];
const nugetCacheDir = nugetPackagesEnv === undefined || nugetPackagesEnv === "" ? path.join(os.homedir(), ".nuget", "packages") : nugetPackagesEnv;
const overridesPath = path.join(import.meta.dirname, "licenses", "nuget-overrides.json");

const EMPTY_NOTICE: LicenseNotice = { license: "", licenseUrl: "", projectUrl: "", noticeText: "" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

function toLicenseNotice(value: unknown): LicenseNotice {
  if (!isRecord(value)) {
    return EMPTY_NOTICE;
  }
  return {
    license: stringField(value, "license"),
    licenseUrl: stringField(value, "licenseUrl"),
    projectUrl: stringField(value, "projectUrl"),
    noticeText: stringField(value, "noticeText"),
  };
}

function parseNugetOverrides(raw: string): Record<string, LicenseNotice> {
  const parsed: unknown = JSON.parse(raw);
  if (!isRecord(parsed)) {
    throw new Error(`${overridesPath} must contain a JSON object`);
  }
  return Object.fromEntries(Object.entries(parsed).map(([packageName, override]) => [packageName, toLicenseNotice(override)]));
}

const nugetOverrides = parseNugetOverrides(fs.readFileSync(overridesPath, "utf8"));

function getOverride(packageName: string): LicenseNotice {
  return nugetOverrides[packageName] ?? EMPTY_NOTICE;
}

function ensureDirectory(directoryPath: string): void {
  fs.mkdirSync(directoryPath, { recursive: true });
}

function readFileIfExists(filePath: string | null | undefined): string | null {
  if (!filePath || !fs.existsSync(filePath)) {
    return null;
  }

  return fs.readFileSync(filePath, "utf8");
}

function normalizeWhitespace(value: string | null | undefined): string {
  return (value ?? "").replace(/\r\n/g, "\n").trim();
}

function sanitizeId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function extractXmlTagValue(xml: string, tagName: string): string {
  const match = new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, "i").exec(xml);

  return (match?.[1] ?? "").trim();
}

function extractXmlSelfClosingTagAttribute(xml: string, tagName: string, attributeName: string): string {
  const match = new RegExp(`<${tagName}[^>]*${attributeName}="([^"]+)"[^>]*>(?:[\\s\\S]*?)<\\/${tagName}>`, "i").exec(xml);

  return (match?.[1] ?? "").trim();
}

function extractRepositoryUrl(xml: string): string {
  const match = /<repository[^>]*url="([^"]+)"/i.exec(xml);

  return (match?.[1] ?? "").trim();
}

function findFirstExistingFile(filePaths: (string | null | undefined)[]): string | null {
  return filePaths.find((filePath) => filePath && fs.existsSync(filePath)) ?? null;
}

function findPackageLicenseFile(packageDir: string): string | null {
  if (!fs.existsSync(packageDir)) {
    return null;
  }

  const stack = [packageDir];

  while (stack.length > 0) {
    const currentDir = stack.pop();
    if (currentDir === undefined) {
      break;
    }
    const dirEntries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const dirEntry of dirEntries) {
      const fullPath = path.join(currentDir, dirEntry.name);

      if (dirEntry.isDirectory()) {
        if (!fullPath.includes(`${path.sep}tools${path.sep}`)) {
          stack.push(fullPath);
        }
        continue;
      }

      if (/^(license|licence|notice|copying)(\.[^.]+)?$/i.test(dirEntry.name)) {
        return fullPath;
      }
    }
  }

  return null;
}

function parseFrontendLicenses(markdown: string): FrontendEntry[] {
  const normalized = normalizeWhitespace(markdown);
  if (!normalized) {
    return [];
  }

  const sections = normalized.split(/\n(?=## )/g).slice(1);

  const entries: FrontendEntry[] = [];
  for (const section of sections) {
    const [headerLine = "", ...bodyLines] = section.split("\n");
    const headerMatch = /^##\s+(.+?)\s+-\s+(.+?)\s+\((.+?)\)$/.exec(headerLine);

    if (!headerMatch) {
      continue;
    }

    const [, packageName = "", version = "", license = ""] = headerMatch;
    const noticeText = normalizeWhitespace(bodyLines.join("\n"));

    entries.push({
      id: `frontend-${sanitizeId(`${packageName}-${version}`)}`,
      name: packageName,
      version,
      license,
      sourceType: "frontend",
      sourceLabel: "Frontend bundle",
      noticeText,
      needsReview: !license && !noticeText,
    });
  }

  return entries.sort((left, right) => left.name.localeCompare(right.name));
}

function parseCsprojPackageReferences(csprojText: string): ComponentEntry[] {
  return [...csprojText.matchAll(/<PackageReference\s+Include="([^"]+)"\s+Version="([^"]+)"/g)].map(([, packageName = "", version = ""]): ComponentEntry => ({
    name: packageName,
    version,
    sourceType: "dotnet",
  }));
}

function parseCsprojBinaryReferences(csprojText: string): ComponentEntry[] {
  const binaryEntries: ComponentEntry[] = [];

  for (const [, include = "", hintPath = ""] of csprojText.matchAll(
    /<Reference\s+Include="([^"]+)">[\s\S]*?<HintPath>([^<]+)<\/HintPath>[\s\S]*?<\/Reference>/g
  )) {
    binaryEntries.push({
      name: include,
      version: "",
      sourceType: "native",
      filePath: hintPath.replaceAll("\\", "/"),
    });
  }

  for (const [, includePath = ""] of csprojText.matchAll(/<None\s+Include="([^"]*libs[^"]+\.(?:dll|so|dylib))">/g)) {
    const normalizedPath = includePath.replaceAll("\\", "/");
    const fileName = path.basename(normalizedPath);
    const overrideName = fileName === "openvr_api.dll" ? "OpenVR SDK" : fileName;

    binaryEntries.push({
      name: overrideName,
      version: "",
      sourceType: "native",
      filePath: normalizedPath,
    });
  }

  return binaryEntries;
}

function parseAssetsLibraries(projectAssetsPath: string): ComponentEntry[] {
  const assetsRaw = readFileIfExists(projectAssetsPath);
  if (!assetsRaw) {
    return [];
  }

  const assets: unknown = JSON.parse(assetsRaw);
  const libraries = isRecord(assets) && isRecord(assets["libraries"]) ? assets["libraries"] : {};

  return Object.keys(libraries)
    .filter((libraryKey) => {
      const library = libraries[libraryKey];
      const libraryType = isRecord(library) ? library["type"] : undefined;
      return !libraryType || libraryType === "package";
    })
    .map((libraryKey): ComponentEntry => {
      const lastSlashIndex = libraryKey.lastIndexOf("/");

      return {
        name: libraryKey.slice(0, lastSlashIndex),
        version: libraryKey.slice(lastSlashIndex + 1),
        sourceType: "dotnet",
      };
    });
}

function mergeDotnetEntries(csprojFiles: string[]): MergedComponentEntry[] {
  const collectedEntries = new Map<string, MergedComponentEntry>();

  for (const csprojFile of csprojFiles) {
    const projectName = path.basename(csprojFile, ".csproj");
    const csprojText = fs.readFileSync(csprojFile, "utf8");
    const assetEntries = parseAssetsLibraries(path.join(path.dirname(csprojFile), "obj", "project.assets.json"));
    const packageEntries = assetEntries.length > 0 ? assetEntries : parseCsprojPackageReferences(csprojText);
    const binaryEntries = parseCsprojBinaryReferences(csprojText);

    for (const entry of [...packageEntries, ...binaryEntries]) {
      const key = `${entry.sourceType}:${entry.name}:${entry.version}`;
      const existingEntry = collectedEntries.get(key) ?? {
        ...entry,
        projects: [],
      };

      const previousProjects = existingEntry.projects;
      existingEntry.projects = [...new Set([...previousProjects, projectName])].sort();
      collectedEntries.set(key, existingEntry);
    }
  }

  return [...collectedEntries.values()].sort((left, right) => left.name.localeCompare(right.name));
}

function resolveNugetMetadata(packageName: string, version: string): LicenseNotice & { needsReview: boolean } {
  const packageDir = path.join(nugetCacheDir, packageName.toLowerCase(), version);
  const nuspecPath =
    findFirstExistingFile([
      path.join(packageDir, `${packageName.toLowerCase()}.nuspec`),
      ...(fs.existsSync(packageDir)
        ? fs
            .readdirSync(packageDir)
            .filter((fileName) => fileName.endsWith(".nuspec"))
            .map((fileName) => path.join(packageDir, fileName))
        : []),
    ]) ?? null;

  const override = getOverride(packageName);
  const metadata = {
    license: override.license,
    licenseUrl: override.licenseUrl,
    projectUrl: override.projectUrl,
    noticeText: normalizeWhitespace(override.noticeText),
    needsReview: false,
  };

  if (!nuspecPath) {
    metadata.needsReview = !metadata.license && !metadata.noticeText;
    return metadata;
  }

  const nuspecText = fs.readFileSync(nuspecPath, "utf8");
  const licenseType = extractXmlSelfClosingTagAttribute(nuspecText, "license", "type");
  const licenseExpression = licenseType === "expression" ? extractXmlTagValue(nuspecText, "license") : "";
  const licenseFilePath = licenseType === "file" ? extractXmlTagValue(nuspecText, "license") : "";

  metadata.license ||= licenseExpression;
  metadata.licenseUrl ||= extractXmlTagValue(nuspecText, "licenseUrl");
  metadata.projectUrl ||= extractXmlTagValue(nuspecText, "projectUrl") || extractRepositoryUrl(nuspecText);

  if (!metadata.noticeText) {
    const embeddedLicensePath = licenseFilePath ? path.join(packageDir, licenseFilePath.replaceAll("\\", path.sep)) : null;
    const discoveredLicensePath = findPackageLicenseFile(packageDir);
    const resolvedLicensePath = findFirstExistingFile([embeddedLicensePath, discoveredLicensePath]);

    metadata.noticeText = normalizeWhitespace(readFileIfExists(resolvedLicensePath));
  }

  metadata.needsReview = !metadata.license && !metadata.noticeText;
  return metadata;
}

function enrichDotnetEntries(entries: MergedComponentEntry[]): ReportedEntry[] {
  return entries.map((entry) => {
    const override = getOverride(entry.name);

    if (entry.sourceType === "native") {
      return {
        id: `native-${sanitizeId(entry.name)}`,
        ...entry,
        license: override.license || "Unknown",
        licenseUrl: override.licenseUrl,
        projectUrl: override.projectUrl,
        noticeText: normalizeWhitespace(override.noticeText),
        sourceLabel: "Bundled native/.NET component",
        needsReview: !override.license && !override.noticeText,
      };
    }

    const metadata = entry.version
      ? resolveNugetMetadata(entry.name, entry.version)
      : {
          license: override.license,
          licenseUrl: override.licenseUrl,
          projectUrl: override.projectUrl,
          noticeText: normalizeWhitespace(override.noticeText),
          needsReview: !override.license && !override.noticeText,
        };

    return {
      id: `${entry.sourceType}-${sanitizeId(`${entry.name}-${entry.version}`)}`,
      ...entry,
      license: metadata.license || "Unknown",
      licenseUrl: metadata.licenseUrl,
      projectUrl: metadata.projectUrl,
      noticeText: metadata.noticeText,
      sourceLabel: "Bundled .NET/native backend component",
      needsReview: metadata.needsReview,
    };
  });
}

function createThirdPartyNoticeText(frontendLicenseMarkdown: string, entries: ReportedEntry[]): string {
  const lines = [
    "VRCX Third-Party Notices",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "========================================",
    "Frontend bundled dependencies",
    "========================================",
    "",
    normalizeWhitespace(frontendLicenseMarkdown) || "No frontend license manifest was available.",
    "",
    "",
    "========================================",
    ".NET and native bundled components",
    "========================================",
    "",
  ];

  for (const entry of entries) {
    lines.push(`${entry.name}${entry.version ? ` - ${entry.version}` : ""} (${entry.license})`);
    lines.push(`Source: ${entry.sourceLabel}`);

    if (entry.projects.length) {
      lines.push(`Used by: ${entry.projects.join(", ")}`);
    }

    if (entry.projectUrl) {
      lines.push(`Project URL: ${entry.projectUrl}`);
    }

    if (entry.licenseUrl) {
      lines.push(`License URL: ${entry.licenseUrl}`);
    }

    if (entry.filePath) {
      lines.push(`Bundled file: ${entry.filePath}`);
    }

    lines.push("");

    if (entry.noticeText) {
      lines.push(entry.noticeText);
    } else {
      lines.push("No local license text was available during generation. Review this component before release.");
    }

    lines.push("");
    lines.push("----------------------------------------");
    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

function main(): void {
  ensureDirectory(outputDir);

  const frontendLicenseMarkdown = readFileIfExists(frontendLicensePath) ?? "";
  const frontendEntries = parseFrontendLicenses(frontendLicenseMarkdown);
  const csprojFiles = fs
    .readdirSync(dotnetDir)
    .filter((fileName) => fileName.endsWith(".csproj"))
    .map((fileName) => path.join(dotnetDir, fileName))
    .concat(path.join(dotnetDir, "DBMerger", "DBMerger.csproj"))
    .filter((filePath, index, filePaths) => filePaths.indexOf(filePath) === index && fs.existsSync(filePath));

  const dotnetEntries = enrichDotnetEntries(mergeDotnetEntries(csprojFiles));
  const manifest = {
    generatedAt: new Date().toISOString(),
    noticePath: "licenses/THIRD_PARTY_NOTICES.txt",
    entries: [...frontendEntries, ...dotnetEntries],
  };

  fs.writeFileSync(outputManifestPath, JSON.stringify(manifest, null, 4));
  fs.writeFileSync(outputNoticePath, createThirdPartyNoticeText(frontendLicenseMarkdown, dotnetEntries));

  const reviewCount = manifest.entries.filter((entry) => entry.needsReview).length;
  console.log(`Generated third-party license manifest with ${manifest.entries.length} entries (${reviewCount} requiring review).`);
}

main();
