import { readdirSync, readFileSync, readlinkSync, statSync } from "node:fs";
import path from "node:path";
import { CliError } from "./errors.js";
import { isDefaultSkipped, isIgnored, parseGitignore } from "./ignore.js";

/**
 * @typedef {object} Node
 * @property {"dir" | "file" | "symlink" | "more" | "unreadable"} kind
 * @property {string} name
 * @property {string} [target]
 * @property {Node[] | undefined} [children] present only after a directory was read
 */

/**
 * @typedef {object} WalkOptions
 * @property {number | null} depth
 * @property {number | null} maxChildren
 * @property {boolean} dirsOnly
 * @property {boolean} useDefaultIgnore
 * @property {boolean} useGitignore
 * @property {import("./ignore.js").Rule[]} extraRules
 * @property {string | null} excludeRel
 */

const CASE_FOLD = process.platform === "win32" || process.platform === "darwin";

/**
 * @param {string} a
 * @param {string} b
 */
function samePath(a, b) {
  if (CASE_FOLD) return a.toLowerCase() === b.toLowerCase();
  return a === b;
}

/**
 * @param {string} abs
 */
function directoryId(abs) {
  try {
    const st = statSync(abs);
    return `${st.dev}:${st.ino}`;
  } catch {
    return abs;
  }
}

/**
 * @param {{ name: string, isDir: boolean }} a
 * @param {{ name: string, isDir: boolean }} b
 */
function compareEntries(a, b) {
  if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
  const byName = a.name.localeCompare(b.name, "en", { sensitivity: "base", numeric: false });
  if (byName !== 0) return byName;
  if (a.name < b.name) return -1;
  if (a.name > b.name) return 1;
  return 0;
}

/**
 * @param {string} abs
 * @param {string} rel
 * @param {import("node:fs").Dirent[]} entries
 * @param {WalkOptions} options
 * @param {import("./ignore.js").Rule[]} parentRules
 * @param {number} depth
 * @param {Set<string>} seen
 * @returns {Node[]}
 */
function walkEntries(abs, rel, entries, options, parentRules, depth, seen) {
  let gitRules = parentRules;
  if (options.useGitignore) {
    const gitignore = entries.find((entry) => entry.name === ".gitignore" && entry.isFile());
    if (gitignore) {
      try {
        const text = readFileSync(path.join(abs, ".gitignore"), "utf8");
        gitRules = parentRules.concat(parseGitignore(text, rel));
      } catch {
        // A .gitignore we cannot read does not hide anything else.
      }
    }
  }

  /** @type {{ name: string, rel: string, isDir: boolean, symlink: boolean }[]} */
  const selected = [];
  for (const entry of entries) {
    const name = entry.name;
    const childRel = rel ? `${rel}/${name}` : name;
    const symlink = entry.isSymbolicLink();
    const isDir = !symlink && entry.isDirectory();
    if (options.excludeRel && samePath(childRel, options.excludeRel)) continue;
    if (options.useDefaultIgnore && isDefaultSkipped(name, isDir)) continue;
    if (isIgnored(childRel, isDir, gitRules, options.extraRules)) continue;
    if (options.dirsOnly && !isDir) continue;
    selected.push({ name, rel: childRel, isDir, symlink });
  }
  selected.sort(compareEntries);

  let kept = selected;
  let omitted = 0;
  if (options.maxChildren != null && selected.length > options.maxChildren) {
    omitted = selected.length - options.maxChildren;
    kept = selected.slice(0, options.maxChildren);
  }

  /** @type {Node[]} */
  const nodes = [];
  for (const item of kept) {
    if (item.isDir) {
      const childAbs = path.join(abs, item.name);
      const atLimit = options.depth != null && depth + 1 >= options.depth;
      const id = directoryId(childAbs);
      if (atLimit || seen.has(id)) {
        nodes.push({ kind: "dir", name: item.name });
        continue;
      }
      seen.add(id);
      nodes.push({
        kind: "dir",
        name: item.name,
        children: readDirectory(childAbs, item.rel, options, gitRules, depth + 1, seen),
      });
      continue;
    }
    if (item.symlink) {
      let target = "";
      try {
        target = readlinkSync(path.join(abs, item.name));
      } catch {
        target = "";
      }
      target = target.replaceAll("\r\n", " ").replaceAll("\n", " ").replaceAll("\r", " ");
      nodes.push({ kind: "symlink", name: item.name, target });
      continue;
    }
    nodes.push({ kind: "file", name: item.name });
  }
  if (omitted > 0) nodes.push({ kind: "more", name: `${omitted} more` });
  return nodes;
}

/**
 * @param {string} abs
 * @param {string} rel
 * @param {WalkOptions} options
 * @param {import("./ignore.js").Rule[]} parentRules
 * @param {number} depth
 * @param {Set<string>} seen
 * @returns {Node[]}
 */
function readDirectory(abs, rel, options, parentRules, depth, seen) {
  try {
    const entries = readdirSync(abs, { withFileTypes: true });
    return walkEntries(abs, rel, entries, options, parentRules, depth, seen);
  } catch (err) {
    const code = err && /** @type {{ code?: string }} */ (err).code;
    if (code === "EACCES" || code === "EPERM" || code === "ENOENT") {
      return [{ kind: "unreadable", name: "(unreadable)" }];
    }
    throw err;
  }
}

/**
 * Children of root. Symlinks are listed and not followed.
 * An ignored directory is not descended into, so a negation inside it cannot bring files back.
 * @param {string} root absolute directory
 * @param {WalkOptions} options
 * @returns {Node[]}
 */
export function walk(root, options) {
  let entries;
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch {
    throw new CliError(`Cannot read directory: ${root}`);
  }
  const seen = new Set([directoryId(root)]);
  return walkEntries(root, "", entries, options, [], 0, seen);
}
