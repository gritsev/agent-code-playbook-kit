import { readFile } from "node:fs/promises";

import { compileProcessIr } from "./compile.js";
import { lintProcessIr } from "./lint.js";
import type { ProcessIr } from "./types.js";

async function main(): Promise<void> {
  const path = process.argv[2];
  if (!path) {
    throw new Error("usage: tsx src/demo.ts <ir.json>");
  }

  const text = await readFile(path, "utf8");
  const ir = JSON.parse(text) as ProcessIr;
  const lint = lintProcessIr(ir);

  process.stdout.write(
    JSON.stringify(
      {
        lint,
        playbook: compileProcessIr(ir),
      },
      null,
      2,
    ) + "\n",
  );
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
