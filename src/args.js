import { CliError } from "./errors.js";
import { compileUserPattern } from "./ignore.js";

/**
 * @typedef {object} ParsedArgs
 * @property {boolean} help
 * @property {boolean} version
 * @property {string | null} path
 * @property {"md" | "html"} format
 * @property {number | null} depth
 * @property {string | null} out
 * @property {boolean} stamp
 * @property {import("./ignore.js").Rule[]} ignore
 * @property {boolean} noDefaultIgnore
 * @property {boolean} noGitignore
 * @property {boolean} dirsOnly
 * @property {number | null} maxChildren
 */

/**
 * @param {string[]} argv
 * @param {number} index
 * @param {string} name
 */
function readValue(argv, index, name) {
  const current = argv[index];
  const eq = current.indexOf("=");
  if (eq !== -1) {
    const value = current.slice(eq + 1);
    if (value === "") {
      throw new CliError(`Missing value for ${name}\nSee yf-tree --help`);
    }
    return { value, next: index + 1 };
  }
  const value = argv[index + 1];
  if (value == null || (value.startsWith("-") && !(name === "--out" && value === "-"))) {
    throw new CliError(`Missing value for ${name}\nSee yf-tree --help`);
  }
  return { value, next: index + 2 };
}

/**
 * @param {string} value
 * @returns {"md" | "html"}
 */
function parseFormat(value) {
  const format = value.toLowerCase();
  if (format !== "md" && format !== "html") {
    throw new CliError(`Format must be md or html.\nSee yf-tree --help`);
  }
  return format;
}

/**
 * @param {string} value
 * @param {string} message
 * @param {number} min
 */
function parseWholeNumber(value, message, min) {
  if (!/^[0-9]+$/.test(value) || Number(value) < min) {
    throw new CliError(`${message}\nSee yf-tree --help`);
  }
  return Number(value);
}

/**
 * @param {string[]} argv process.argv
 * @returns {ParsedArgs}
 */
export function parseArgs(argv) {
  const args = argv.slice(2);
  let help = false;
  let version = false;
  /** @type {"md" | "html"} */
  let format = "md";
  /** @type {number | null} */
  let depth = null;
  /** @type {string | null} */
  let out = null;
  let stamp = false;
  /** @type {string[]} */
  const ignore = [];
  let noDefaultIgnore = false;
  let noGitignore = false;
  let dirsOnly = false;
  /** @type {number | null} */
  let maxChildren = null;
  /** @type {string[]} */
  const positionals = [];

  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === "--") {
      positionals.push(...args.slice(i + 1));
      break;
    }
    if (a === "--help" || a === "-h") {
      help = true;
      continue;
    }
    if (a === "--version" || a === "-V") {
      version = true;
      continue;
    }
    if (a === "--stamp") {
      stamp = true;
      continue;
    }
    if (a === "--no-default-ignore") {
      noDefaultIgnore = true;
      continue;
    }
    if (a === "--no-gitignore") {
      noGitignore = true;
      continue;
    }
    if (a === "--dirs-only") {
      dirsOnly = true;
      continue;
    }

    const eq = a.indexOf("=");
    const name = eq === -1 ? a : a.slice(0, eq);
    if (
      name === "--format" ||
      name === "--depth" ||
      name === "--out" ||
      name === "--ignore" ||
      name === "--max-children"
    ) {
      const { value, next } = readValue(args, i, name);
      i = next - 1;
      if (name === "--format") format = parseFormat(value);
      else if (name === "--depth") depth = parseWholeNumber(value, "Depth must be a positive integer.", 1);
      else if (name === "--out") out = value;
      else if (name === "--ignore") ignore.push(value);
      else maxChildren = parseWholeNumber(value, "Max children must be a whole number, 0 or more.", 0);
      continue;
    }

    if (a.startsWith("-")) {
      throw new CliError(`Unknown flag: ${a}\nSee yf-tree --help`);
    }
    positionals.push(a);
  }

  if (positionals.length > 1) {
    throw new CliError(`Unexpected argument: ${positionals[1]}\nSee yf-tree --help`);
  }

  return {
    help,
    version,
    path: positionals[0] ?? null,
    format,
    depth,
    out,
    stamp,
    ignore: ignore.map((pattern) => compileUserPattern(pattern)),
    noDefaultIgnore,
    noGitignore,
    dirsOnly,
    maxChildren,
  };
}

export function helpText() {
  return `yf-tree — write a directory tree

Usage:
  yf-tree [path] [options]

path defaults to ., the directory you are in.
yf-tree apps/web scans that folder. The output file is still written
relative to where you ran the command.

Options:
  --format <md|html>     md (default) or html. The output extension does not set this.
  --depth <n>            Positive integer. --depth 1 is the root plus its children.
                         Deeper levels are omitted, not collapsed.
  --out <path>           A file, a directory, or - for stdout.
                         Default: ./yf-tree-out/tree.md or tree.html
                         A path with no extension is a directory.
                         A last segment with an extension is a file.
  --stamp                Add a local timestamp to the file name:
                         tree-2026-11-05-143022.md
  --ignore <pattern>     Extra name or glob to skip. Repeatable.
                         Added on top of the built-in skips. Gitignore syntax.
  --no-default-ignore    Turn the built-in skips off.
  --no-gitignore         Also list paths a .gitignore in the scanned tree would hide.
  --dirs-only            Directories only.
  --max-children <n>     Max entries kept per folder. The rest become one line, N more.
  --help, -h             Show this help.
  --version, -V          Show the version.

Markdown is a fenced tree. HTML is one self-contained dark page with
expand and collapse. No file-type badges.

Directories first, then files, A to Z, case insensitive.
Symlinks are listed and not followed.
The output file is left out of the listing when it sits inside the scanned tree.

Built-in skips hide VCS, dependency, cache, and coverage directories, plus
.DS_Store, Thumbs.db, desktop.ini, and *.pyc. Names such as dist, build,
out, and .env stay visible unless .gitignore or --ignore hides them.
File contents are not written; that is yf-dump.
Dotfiles other than the built-in skips stay visible.

.gitignore files above the scanned path are not read. Node 20+.`.trim();
}
