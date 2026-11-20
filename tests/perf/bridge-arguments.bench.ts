import { expect, test } from "vitest";
import { reactive } from "vue";

import { unwrapBridgeArguments } from "../../src/shared/utils/bridge-arguments.ts";

const vipIds = Array.from({ length: 2000 }, (_, index) => `usr_${String(index)}`);
const plainArgs = ["Location", ["Location"], vipIds, "usr_self", 50];
const reactiveArgs = ["Location", reactive(["Location"]), reactive(vipIds), "usr_self", 50];

test("DatabaseApi.SearchGameLog arguments", async ({ bench }) => {
  let received: unknown[] = [];
  function receiveArguments(...args: unknown[]) {
    received = args;
  }

  const cases = [
    { name: "plain, without unwrapping", args: plainArgs, unwrap: false },
    { name: "plain, with unwrapping", args: plainArgs, unwrap: true },
    { name: "reactive, without unwrapping", args: reactiveArgs, unwrap: false },
    { name: "reactive, with unwrapping", args: reactiveArgs, unwrap: true },
  ];
  const rows = ["   mean µs     p99 µs  benchmark"];

  for (const { name, args, unwrap } of cases) {
    const result = await bench(name, () => {
      receiveArguments(...(unwrap ? unwrapBridgeArguments(args) : args));
    }).run();
    const mean = (result.latency.mean * 1000).toFixed(3);
    const p99 = (result.latency.p99 * 1000).toFixed(3);
    rows.push(`${mean.padStart(10)} ${p99.padStart(10)}  ${name}`);
  }

  expect(received).toHaveLength(plainArgs.length);
  process.stdout.write(`\n${rows.join("\n")}\n`);
});
