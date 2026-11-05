import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { main } from "../src/index.js";

export function tempDir() {
  return mkdtempSync(path.join(tmpdir(), "yf-tree-"));
}

/**
 * @param {string} dir
 * @param {string} rel posix relative path
 * @param {string} [content]
 */
export function writeRel(dir, rel, content = "") {
  const abs = path.join(dir, ...rel.split("/"));
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, content);
  return abs;
}

/**
 * @param {string} dir
 */
export function remove(dir) {
  rmSync(dir, { recursive: true, force: true });
}

/**
 * @param {string[]} argv
 * @param {string} cwd
 * @param {Record<string, unknown>} [extra]
 */
export function run(argv, cwd, extra = {}) {
  let out = "";
  let err = "";
  const code = main(["node", "yf-tree", ...argv], {
    cwd,
    now: () => new Date(2026, 10, 5, 14, 30, 22),
    log: (msg) => {
      out += `${msg}\n`;
    },
    err: (msg) => {
      err += `${msg}\n`;
    },
    write: (text) => {
      out += text;
    },
    ...extra,
  });
  return { code, out, err };
}

/**
 * Names after the tree branch, so `node_modules_backup` does not count as `node_modules`.
 * @param {string} markdown
 */
export function entryNames(markdown) {
  return markdown
    .split("\n")
    .filter((line) => line.includes("── "))
    .map((line) => line.split("── ").at(-1));
}
