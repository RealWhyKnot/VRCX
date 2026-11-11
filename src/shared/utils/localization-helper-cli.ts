import fs from "node:fs";
import nodeprocess from "node:process";
import path from "node:path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

type LocaleTree = { [key: string]: LocaleTree | string };

type LocaleFile = [string, LocaleTree];

type PendingAdd = [LocaleTree, string[], string, string | undefined];

type AddArgs = { key: string; value: string; above_key?: string };

type KeyArgs = { key: string };

function isLocaleTree(value: unknown): value is LocaleTree {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const children: unknown[] = Object.values(value);
  return children.every((child) => typeof child === "string" || isLocaleTree(child));
}

function languageLabel(obj: LocaleTree): string {
  const language = obj["language"];
  return typeof language === "string" ? language : "undefined";
}

function* getLocalizationObjects(): Generator<LocaleFile> {
  const localeFolder = "./src/localization";
  const files = fs.readdirSync(localeFolder, { withFileTypes: true }).filter((file) => file.isFile() && path.extname(file.name).toLowerCase() === ".json");
  for (const file of files) {
    const filePath = path.join(localeFolder, file.name);
    const jsonStr = fs.readFileSync(filePath).toString("utf8");
    const parsed: unknown = JSON.parse(jsonStr);
    if (!isLocaleTree(parsed)) {
      throw new Error(`${filePath} is not a localization tree of strings`);
    }
    yield [filePath, parsed];
  }
}

function writeLocaleFile(localePath: string, localeObj: LocaleTree): void {
  fs.writeFileSync(localePath, `${JSON.stringify(localeObj, null, 4)}\n`);
}

function addKey(obj: LocaleTree, objects: string[], value: string, aboveKey: string | undefined): void {
  console.log(`Adding key to ${languageLabel(obj)} at path '${objects.join(".")}' with value '${value}' above key '${String(aboveKey)}'`);

  let currentObj = obj;
  let i = 0;

  for (; i < objects.length - 1; i++) {
    const segment = objects[i] ?? "";
    if (!Object.hasOwn(currentObj, segment)) {
      currentObj[segment] = {};
    }

    const next = currentObj[segment];
    if (typeof next !== "object") {
      throw new Error(`Cannot add '${objects.join(".")}': '${segment}' holds a string`);
    }
    currentObj = next;
  }
  insertKeyInObj(currentObj, objects[i] ?? "", value, aboveKey);
}

function insertKeyInObj(obj: LocaleTree, key: string, value: string, aboveKey: string | undefined): void {
  const keys = Object.keys(obj);
  if (keys.length === 0 || aboveKey === undefined || !Object.hasOwn(obj, aboveKey)) {
    obj[key] = value;
    return;
  }

  keys.unshift("dummy");
  obj["dummy"] = {};
  const ret = keys.reduce<LocaleTree>((newObj, currKey, i) => {
    if (currKey !== key) {
      const current = obj[currKey];
      if (current !== undefined) {
        newObj[currKey] = current;
      }
    }

    if (i < keys.length - 1 && keys[i + 1] === aboveKey) {
      newObj[key] = value;
    }

    return newObj;
  }, {});
  delete ret["dummy"];

  for (const existingKey of keys) {
    Reflect.deleteProperty(obj, existingKey);
  }

  Object.assign(obj, ret);
}

function addLocalizationKey(key: string, value: string, aboveKey: string | undefined): void {
  const objects = key.split(".");

  for (const [localePath, localeObj] of getLocalizationObjects()) {
    addKey(localeObj, objects, value, aboveKey);
    writeLocaleFile(localePath, localeObj);
  }

  console.log(`\`${key}:${value}\` added to every localization file!`);
}

function removeKey(obj: LocaleTree, objects: string[], i = 0): void {
  const segment = objects[i] ?? "";
  console.log(`Removing key from ${languageLabel(obj)} at path '${objects.join(".")}'`);
  if (!Object.hasOwn(obj, segment)) {
    return;
  }

  if (objects.length - 1 === i) {
    Reflect.deleteProperty(obj, segment);
  } else {
    const child = obj[segment];
    if (typeof child !== "object") {
      return;
    }
    removeKey(child, objects, i + 1);
    if (Object.keys(child).length === 0) {
      Reflect.deleteProperty(obj, segment);
    }
  }
}

function removeLocalizationKey(key: string): void {
  const objects = key.split(".");
  for (const [localePath, localeObj] of getLocalizationObjects()) {
    removeKey(localeObj, objects, 0);

    writeLocaleFile(localePath, localeObj);
  }

  console.log(`\`${key}\` removed from every localization file!`);
}

function traverse(obj: LocaleTree, predicate: (key: string, value: string, paths: string[]) => void, paths: string[] = []): void {
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (typeof value === "string") {
      predicate(key, value, paths);
    } else if (value !== undefined) {
      traverse(value, predicate, [...paths, key]);
    }
  }
}

function resolveParent(root: LocaleTree, paths: string[]): LocaleTree | undefined {
  let current: LocaleTree | string | undefined = root;
  for (const pathSegment of paths) {
    if (typeof current !== "object" || !Object.hasOwn(current, pathSegment)) {
      return undefined;
    }
    current = current[pathSegment];
  }
  return typeof current === "object" ? current : undefined;
}

function validate(): void {
  const files = [...getLocalizationObjects()];
  const enIndex = files.findIndex((file) => path.basename(file[0]) === "en.json");
  const enEntry = files.splice(enIndex, 1)[0];
  if (!enEntry) {
    throw new Error("en.json was not found in the localization folder");
  }
  const enObj = enEntry[1];

  let hasRemoved = false;
  for (const [, localeObj] of files) {
    const toRemove: string[][] = [];
    traverse(localeObj, (key, _value, paths) => {
      const parent = resolveParent(enObj, paths);
      if (parent === undefined || !Object.hasOwn(parent, key)) {
        toRemove.push([...paths, key]);
      }
    });

    for (const toRemovePath of toRemove) {
      removeKey(localeObj, toRemovePath);
      hasRemoved = true;
    }
  }

  const toAdd: PendingAdd[] = [];
  traverse(enObj, (key, value, paths) => {
    const lastPending = toAdd.at(-1);
    if (lastPending && lastPending[3] === undefined && lastPending[1].at(-2) === paths.at(-1)) {
      lastPending[3] = key;
    }

    for (const [, localeObj] of files) {
      const parent = resolveParent(localeObj, paths);
      if (parent === undefined) {
        toAdd.push([localeObj, [...paths, key], value, undefined]);
        return;
      }
      if (!Object.hasOwn(parent, key)) {
        toAdd.push([localeObj, [...paths, key], value, undefined]);
      }
    }
  });

  for (const [localeObj, objects, value, aboveKey] of toAdd) {
    addKey(localeObj, objects, value, aboveKey);
  }

  if (toAdd.length > 0 || hasRemoved) {
    for (const [localePath, localeObj] of files) {
      writeLocaleFile(localePath, localeObj);
    }
  } else {
    console.log("validation passed!");
  }
}

const cliParser = yargs(hideBin(nodeprocess.argv))
  .command<AddArgs>({
    command: "add <key> <value> [above_key]",
    aliases: ["a", "replace", "r"],
    desc: "adds or replaces a key and value to all localization files above `above_key`",
    handler: (argv) => addLocalizationKey(argv.key, argv.value, argv.above_key),
  })
  .command<KeyArgs>({
    command: "remove <key>",
    aliases: ["rm", "r"],
    desc: "removes key from all localization files",
    handler: (argv) => removeLocalizationKey(argv.key),
  })
  .command({
    command: "validate",
    aliases: [],
    desc: "removes keys from other languages that don't exist in the en translation and adds keys that don't exist in other languages",
    handler: validate,
  })
  .demandCommand(1)
  .example([
    ['$0 add foo.bar "I\'m adding a key!"', "Adding a key as `foo.bar`"],
    ["$0 remove foo.bar", "removes the foo.bar key"],
    ['$0 add foo.bar "I\'m adding a key!" baz', "Adding a key aboe the existing `foo.baz` key"],
  ])
  .help(false)
  .version(false);

cliParser
  .wrap(cliParser.terminalWidth())
  .command({
    command: "help",
    aliases: ["h"],
    desc: "Shows the help message",
    handler: () => cliParser.showHelp(),
  })
  .fail(() => cliParser.showHelp())
  .parse();
