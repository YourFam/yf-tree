import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { helpText, parseArgs } from "./args.js";
import { CliError } from "./errors.js";
import { displayPath, displayWritten, relativeInside, resolveOutput } from "./output.js";
import { renderHtml, renderMarkdown } from "./render.js";
import { ensureOutputGitignore } from "./repo-gitignore.js";
import { walk } from "./walk.js";

const pkg = JSON.parse(
  readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "package.json"), "utf8"),
);

function defaultDeps() {
  return {
    cwd: process.cwd(),
    version: pkg.version,
    now: () => new Date(),
    log: (msg) => console.log(msg),
    err: (msg) => console.error(msg),
    write: (text) => process.stdout.write(text),
  };
}

/**
 * @param {string} scanRoot
 * @param {string} display
 */
function assertScanRoot(scanRoot, display) {
  let st;
  try {
    st = statSync(scanRoot);
  } catch (err) {
    const code = err && /** @type {{ code?: string }} */ (err).code;
    if (code === "ENOENT") throw new CliError(`Path not found: ${display}`);
    throw new CliError(`Cannot read path: ${display}`);
  }
  if (!st.isDirectory()) throw new CliError(`Not a directory: ${display}`);
}

/**
 * @param {ReturnType<typeof parseArgs>} args
 * @param {ReturnType<typeof defaultDeps>} deps
 */
function execute(args, deps) {
  if (args.help) {
    deps.log(helpText());
    return 0;
  }
  if (args.version) {
    deps.log(deps.version);
    return 0;
  }

  const input = args.path ?? ".";
  const scanRoot = path.resolve(deps.cwd, input);
  assertScanRoot(scanRoot, input);

  const output = resolveOutput({
    cwd: deps.cwd,
    format: args.format,
    out: args.out,
    stamp: args.stamp,
    now: deps.now(),
  });
  const excludeRel = output.filePath ? relativeInside(scanRoot, output.filePath) : null;
  const nodes = walk(scanRoot, {
    depth: args.depth,
    maxChildren: args.maxChildren,
    dirsOnly: args.dirsOnly,
    useDefaultIgnore: !args.noDefaultIgnore,
    useGitignore: !args.noGitignore,
    extraRules: args.ignore,
    excludeRel,
  });
  const label = displayPath(input);
  const body = args.format === "html" ? renderHtml(label, nodes) : renderMarkdown(label, nodes);

  if (output.stdout) {
    deps.write(body);
  } else {
    try {
      mkdirSync(path.dirname(output.filePath), { recursive: true });
      writeFileSync(output.filePath, body);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new CliError(`Cannot write ${output.filePath}: ${message}`);
    }
    deps.err(`wrote ${displayWritten(deps.cwd, output.filePath)}`);
  }

  if (args.gitignore) noteGitignore(deps);
  return 0;
}

/**
 * @param {ReturnType<typeof defaultDeps>} deps
 */
function noteGitignore(deps) {
  const result = ensureOutputGitignore(deps.cwd);
  const shown = displayWritten(deps.cwd, result.file);
  deps.err(
    result.status === "added" ? `added yf-tree-out/ to ${shown}` : `yf-tree-out/ already in ${shown}`,
  );
}

/**
 * @param {string[]} argv
 * @param {Partial<ReturnType<typeof defaultDeps>>} [overrides]
 * @returns {number}
 */
export function main(argv, overrides = {}) {
  const deps = { ...defaultDeps(), ...overrides };
  try {
    return execute(parseArgs(argv), deps);
  } catch (err) {
    if (err instanceof CliError) {
      deps.err(err.message);
      return err.exitCode ?? 1;
    }
    throw err;
  }
}

/**
 * @param {string[]} argv
 */
export function run(argv) {
  try {
    const code = main(argv);
    process.exit(code);
  } catch (err) {
    const message = err instanceof Error && err.message ? err.message : String(err);
    console.error(message);
    process.exit(err instanceof CliError ? err.exitCode : 1);
  }
}
