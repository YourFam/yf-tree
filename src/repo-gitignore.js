import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { CliError } from "./errors.js";

/** Directory entry written to the repository root .gitignore. */
export const GITIGNORE_ENTRY = "yf-tree-out/";

const ALREADY = new Set(["yf-tree-out", "yf-tree-out/", "/yf-tree-out", "/yf-tree-out/"]);

/**
 * @param {string} start
 * @returns {string | null}
 */
export function findGitRoot(start) {
  let dir = path.resolve(start);
  for (;;) {
    if (existsSync(path.join(dir, ".git"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * @param {string} text
 */
export function gitignoreHasEntry(text) {
  return text.split(/\r?\n/).some((line) => ALREADY.has(line.trim()));
}

/**
 * Add yf-tree-out/ to the git root .gitignore. Creates the file when it is missing.
 * A second run does not add a duplicate line.
 * @param {string} cwd
 * @returns {{ status: "added" | "present", file: string }}
 */
export function ensureOutputGitignore(cwd) {
  const root = findGitRoot(cwd);
  if (!root) {
    throw new CliError("No git repository found. --gitignore edits the repository root .gitignore.");
  }

  const file = path.join(root, ".gitignore");
  let text = "";
  let existed = false;
  try {
    text = readFileSync(file, "utf8");
    existed = true;
  } catch (err) {
    const code = err && /** @type {{ code?: string }} */ (err).code;
    if (code !== "ENOENT") {
      const message = err instanceof Error ? err.message : String(err);
      throw new CliError(`Cannot read ${file}: ${message}`);
    }
  }

  if (gitignoreHasEntry(text)) return { status: "present", file };

  const nl = text.includes("\r\n") ? "\r\n" : "\n";
  let next;
  if (!existed || text.length === 0) {
    next = `${GITIGNORE_ENTRY}${nl}`;
  } else {
    const sep = text.endsWith("\n") || text.endsWith("\r") ? "" : nl;
    next = `${text}${sep}${GITIGNORE_ENTRY}${nl}`;
  }

  try {
    writeFileSync(file, next);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new CliError(`Cannot write ${file}: ${message}`);
  }
  return { status: "added", file };
}
