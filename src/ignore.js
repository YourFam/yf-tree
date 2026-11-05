import { CliError } from "./errors.js";

/** Directory names hidden even when no .gitignore lists them. */
export const DEFAULT_SKIP_DIRS = [
  ".git",
  ".svn",
  ".hg",
  "node_modules",
  "bower_components",
  ".pnp",
  "__pycache__",
  ".venv",
  "venv",
  ".tox",
  ".pytest_cache",
  ".mypy_cache",
  ".ruff_cache",
  ".next",
  ".nuxt",
  ".turbo",
  ".cache",
  ".parcel-cache",
  ".expo",
  "coverage",
  "htmlcov",
  ".nyc_output",
];

/** File names hidden anywhere in the tree. `*.pyc` is separate. */
export const DEFAULT_SKIP_FILES = [".DS_Store", "Thumbs.db", "desktop.ini"];

const DIR_NAMES = new Set(DEFAULT_SKIP_DIRS.map((name) => name.toLowerCase()));
const FILE_NAMES = new Set(DEFAULT_SKIP_FILES.map((name) => name.toLowerCase()));

/**
 * @param {string} name
 * @param {boolean} isDir
 */
export function isDefaultSkipped(name, isDir) {
  const lower = name.toLowerCase();
  if (isDir) return DIR_NAMES.has(lower);
  if (FILE_NAMES.has(lower)) return true;
  return lower.endsWith(".pyc");
}

/**
 * @param {string} char
 */
function escapeRe(char) {
  return "\\^$.|+()[]{}*?".includes(char) ? `\\${char}` : char;
}

/**
 * Gitignore-style glob. Unanchored patterns may match in any directory.
 * `**` matches across segments. A trailing `/**` matches the contents, not the directory itself.
 * @param {string} pattern
 * @param {boolean} anchored
 */
function makeRe(pattern, anchored) {
  let re = "";
  let i = 0;
  while (i < pattern.length) {
    const c = pattern[i];
    if (c === "\\") {
      if (i + 1 >= pattern.length) {
        re += "\\\\";
        i += 1;
        continue;
      }
      re += escapeRe(pattern[i + 1]);
      i += 2;
      continue;
    }
    if (c === "*") {
      if (pattern[i + 1] === "*") {
        if (pattern[i + 2] === "/") {
          re += "(?:.*/)?";
          i += 3;
          continue;
        }
        re += ".*";
        i += 2;
        continue;
      }
      re += "[^/]*";
      i += 1;
      continue;
    }
    if (c === "?") {
      re += "[^/]";
      i += 1;
      continue;
    }
    if (c === "[") {
      const close = pattern.indexOf("]", i + 1);
      if (close > i + 1) {
        let body = pattern.slice(i + 1, close);
        if (body.startsWith("!")) body = `^${body.slice(1)}`;
        re += `[${body}]`;
        i = close + 1;
        continue;
      }
    }
    if (
      c === "/" &&
      pattern[i + 1] === "*" &&
      pattern[i + 2] === "*" &&
      (pattern[i + 3] === "/" || pattern[i + 3] === undefined)
    ) {
      if (pattern[i + 3] === "/") {
        re += "(?:/.*)?/";
        i += 4;
        continue;
      }
      re += "/.*";
      i += 3;
      continue;
    }
    re += escapeRe(c);
    i += 1;
  }
  if (!anchored) re = `(?:.*/)?${re}`;
  return new RegExp(`^${re}$`);
}

/**
 * @param {string} line
 */
function stripTrailingSpace(line) {
  let end = line.length;
  while (end > 0 && line[end - 1] === " ") {
    let slashes = 0;
    for (let i = end - 2; i >= 0 && line[i] === "\\"; i -= 1) slashes += 1;
    if (slashes % 2 === 1) break;
    end -= 1;
  }
  return line.slice(0, end);
}

/**
 * @typedef {object} Rule
 * @property {boolean} negation
 * @property {boolean} dirOnly
 * @property {RegExp} re
 * @property {string} base posix path of the .gitignore directory, relative to the scan root
 */

/**
 * @param {string} raw
 * @param {{ comments?: boolean }} [options]
 * @returns {Omit<Rule, "base"> | null}
 */
function parsePatternLine(raw, options = {}) {
  const comments = options.comments !== false;
  let line = stripTrailingSpace(raw);
  if (!line) return null;
  if (comments && line.startsWith("#")) return null;

  let negation = false;
  if (line.startsWith("!")) {
    negation = true;
    line = line.slice(1);
  } else if (line.startsWith("\\!")) {
    line = `!${line.slice(2)}`;
  }
  if (!line) return null;

  let dirOnly = false;
  if (line.endsWith("/")) {
    let slashes = 0;
    for (let i = line.length - 2; i >= 0 && line[i] === "\\"; i -= 1) slashes += 1;
    if (slashes % 2 === 0) {
      dirOnly = true;
      line = line.slice(0, -1);
    }
  }
  if (!line) return null;

  let anchored = false;
  if (line.startsWith("/")) {
    anchored = true;
    line = line.slice(1);
  }
  if (line.includes("/")) anchored = true;
  if (!line) return null;

  return { negation, dirOnly, re: makeRe(line, anchored) };
}

/**
 * @param {string} text
 * @param {string} [base] directory that owns this .gitignore, relative to the scan root
 * @returns {Rule[]}
 */
export function parseGitignore(text, base = "") {
  const lines = String(text).split(/\r?\n/);
  if (lines.length) lines[0] = lines[0].replace(/^\uFEFF/, "");
  const basePosix = String(base).replaceAll("\\", "/");
  /** @type {Rule[]} */
  const rules = [];
  for (const line of lines) {
    const rule = parsePatternLine(line, { comments: true });
    if (!rule) continue;
    rules.push({ ...rule, base: basePosix });
  }
  return rules;
}

/**
 * One `--ignore` value. `#` is a pattern here, not a comment.
 * @param {string} pattern
 * @returns {Rule}
 */
export function compileUserPattern(pattern) {
  const rule = parsePatternLine(pattern, { comments: false });
  if (!rule) {
    throw new CliError(`Invalid --ignore pattern: ${pattern}\nSee yf-tree --help`);
  }
  return { ...rule, base: "" };
}

/**
 * @param {Rule} rule
 * @param {string} rel posix path relative to the scan root
 * @param {boolean} isDir
 */
function ruleMatches(rule, rel, isDir) {
  let suffix = rel;
  if (rule.base) {
    if (rel === rule.base) return false;
    const prefix = `${rule.base}/`;
    if (!rel.startsWith(prefix)) return false;
    suffix = rel.slice(prefix.length);
  }
  if (rule.dirOnly && !isDir) return false;
  return rule.re.test(suffix);
}

/**
 * Last matching rule wins. `seen` is false when no rule matched.
 * @param {string} rel
 * @param {boolean} isDir
 * @param {Rule[]} rules
 */
export function decideIgnore(rel, isDir, rules) {
  let seen = false;
  let ignored = false;
  for (const rule of rules) {
    if (!ruleMatches(rule, rel, isDir)) continue;
    seen = true;
    ignored = !rule.negation;
  }
  return { seen, ignored };
}

/**
 * `--ignore` is applied after .gitignore so it can hide a path a negation brought back.
 * A `--ignore` negation (`!name`) can show a path .gitignore hid.
 * @param {string} rel
 * @param {boolean} isDir
 * @param {Rule[]} gitRules
 * @param {Rule[]} extraRules
 */
export function isIgnored(rel, isDir, gitRules, extraRules) {
  const extra = decideIgnore(rel, isDir, extraRules);
  if (extra.seen) return extra.ignored;
  return decideIgnore(rel, isDir, gitRules).ignored;
}
