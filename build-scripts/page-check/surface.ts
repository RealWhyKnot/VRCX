import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import ts from "typescript";

import type { BridgeSurface, ReturnKind } from "./contract.ts";

const HOST_TYPES = new Map([
  ["HostAppApi", "AppApi"],
  ["HostWebApi", "WebApi"],
  ["HostVRCXStorage", "VRCXStorage"],
  ["HostLogWatcher", "LogWatcher"],
  ["HostDiscord", "Discord"],
  ["HostAssetBundleManager", "AssetBundleManager"],
]);

const KEYWORD_KINDS = new Map<ts.SyntaxKind, ReturnKind>([
  [ts.SyntaxKind.VoidKeyword, "void"],
  [ts.SyntaxKind.UndefinedKeyword, "void"],
  [ts.SyntaxKind.NumberKeyword, "number"],
  [ts.SyntaxKind.BooleanKeyword, "boolean"],
  [ts.SyntaxKind.StringKeyword, "string"],
  [ts.SyntaxKind.UnknownKeyword, "null"],
]);

function classify(node: ts.TypeNode | undefined): ReturnKind {
  if (node === undefined) {
    return "void";
  }
  if (ts.isTypeReferenceNode(node) && node.typeName.getText() === "Promise") {
    return classify(node.typeArguments?.[0]);
  }
  if (ts.isUnionTypeNode(node)) {
    return node.types.some((member) => member.kind === ts.SyntaxKind.LiteralType && member.getText() === "null") ? "null" : classify(node.types[0]);
  }
  if (ts.isArrayTypeNode(node) || ts.isTupleTypeNode(node)) {
    return "array";
  }
  return KEYWORD_KINDS.get(node.kind) ?? "object";
}

function methodsOf(literal: ts.TypeLiteralNode): { name: string; kind: ReturnKind }[] {
  return literal.members.filter(ts.isMethodSignature).map((member) => ({ name: member.name.getText(), kind: classify(member.type) }));
}

function typeLiterals(source: ts.SourceFile): { name: string; literal: ts.TypeLiteralNode }[] {
  return source.statements.filter(ts.isTypeAliasDeclaration).flatMap((statement) => {
    const literal = statement.type;
    return ts.isTypeLiteralNode(literal) ? [{ name: statement.name.text, literal }] : [];
  });
}

async function parse(file: string): Promise<ts.SourceFile> {
  return ts.createSourceFile(file, await readFile(file, "utf8"), ts.ScriptTarget.Latest, true);
}

async function readBridgeSurface(root: string): Promise<BridgeSurface> {
  const globals = await parse(path.join(root, "src/types/globals.d.ts"));
  const hosts = typeLiterals(globals).flatMap(({ name, literal }) => {
    const bridge = HOST_TYPES.get(name);
    return bridge === undefined ? [] : [{ bridge, methods: methodsOf(literal) }];
  });
  const databaseDir = path.join(root, "src/services/database");
  const bridgeFiles = (await readdir(databaseDir)).filter((file) => file.startsWith("bridge-") && file.endsWith(".ts"));
  const sources = await Promise.all(bridgeFiles.map((file) => parse(path.join(databaseDir, file))));
  const database = sources.flatMap((source) => typeLiterals(source).flatMap(({ literal }) => methodsOf(literal)));
  if (hosts.length !== HOST_TYPES.size || database.length === 0) {
    throw new Error("Could not read the host bridge declarations; check src/types/globals.d.ts and src/services/database/bridge-*.ts");
  }
  return [...hosts, { bridge: "DatabaseApi", methods: database }];
}

export { readBridgeSurface };
