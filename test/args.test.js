import assert from "node:assert/strict";
import { test } from "node:test";
import { helpText, parseArgs } from "../src/args.js";
import { CliError } from "../src/errors.js";
import { decideIgnore } from "../src/ignore.js";

const sh = (...rest) => ["node", "yf-tree", ...rest];

function throwsMessage(fn, re) {
  assert.throws(fn, (err) => {
    assert.ok(err instanceof CliError);
    assert.equal(err.exitCode, 1);
    assert.match(err.message, re);
    assert.match(err.message, /yf-tree --help/);
    return true;
  });
}

test("defaults", () => {
  const args = parseArgs(sh());
  assert.equal(args.path, null);
  assert.equal(args.format, "md");
  assert.equal(args.depth, null);
  assert.equal(args.out, null);
  assert.equal(args.stamp, false);
  assert.deepEqual(args.ignore, []);
  assert.equal(args.noDefaultIgnore, false);
  assert.equal(args.noGitignore, false);
  assert.equal(args.dirsOnly, false);
  assert.equal(args.maxChildren, null);
});

test("path and flags in either order", () => {
  const a = parseArgs(sh("apps/web", "--format", "html", "--depth", "2"));
  assert.equal(a.path, "apps/web");
  assert.equal(a.format, "html");
  assert.equal(a.depth, 2);

  const b = parseArgs(sh("--format=MD", "--out", "docs", "apps/web"));
  assert.equal(b.format, "md");
  assert.equal(b.out, "docs");
  assert.equal(b.path, "apps/web");
});

test("boolean flags and repeatable ignore", () => {
  const args = parseArgs(
    sh("--stamp", "--no-default-ignore", "--no-gitignore", "--dirs-only", "--ignore", "dist", "--ignore", "*.log"),
  );
  assert.equal(args.stamp, true);
  assert.equal(args.noDefaultIgnore, true);
  assert.equal(args.noGitignore, true);
  assert.equal(args.dirsOnly, true);
  assert.equal(decideIgnore("dist", true, args.ignore).ignored, true);
  assert.equal(decideIgnore("dir/a.log", false, args.ignore).ignored, true);
  assert.equal(decideIgnore("dir/a.txt", false, args.ignore).ignored, false);
});

test("-- separates a path that looks like a flag", () => {
  const args = parseArgs(sh("--", "--weird"));
  assert.equal(args.path, "--weird");
});

test("stdout out and limits", () => {
  assert.equal(parseArgs(sh("--out", "-")).out, "-");
  assert.equal(parseArgs(sh("--out=-")).out, "-");
  assert.equal(parseArgs(sh("--max-children", "0")).maxChildren, 0);
  assert.equal(parseArgs(sh("--max-children=12")).maxChildren, 12);
});

test("help and version", () => {
  assert.equal(parseArgs(sh("--help")).help, true);
  assert.equal(parseArgs(sh("-h")).help, true);
  assert.equal(parseArgs(sh("--version")).version, true);
  assert.equal(parseArgs(sh("-V")).version, true);
});

test("rejects bad input", () => {
  throwsMessage(() => parseArgs(sh("--format", "json")), /Format must be md or html/);
  throwsMessage(() => parseArgs(sh("--depth", "0")), /positive integer/);
  throwsMessage(() => parseArgs(sh("--depth", "1.5")), /positive integer/);
  throwsMessage(() => parseArgs(sh("--depth")), /Missing value for --depth/);
  throwsMessage(() => parseArgs(sh("--out")), /Missing value for --out/);
  throwsMessage(() => parseArgs(sh("--ignore")), /Missing value for --ignore/);
  throwsMessage(() => parseArgs(sh("--ignore=")), /Missing value for --ignore/);
  throwsMessage(() => parseArgs(sh("--max-children", "-1")), /Missing value for --max-children/);
  throwsMessage(() => parseArgs(sh("--nope")), /Unknown flag: --nope/);
  throwsMessage(() => parseArgs(sh("a", "b")), /Unexpected argument: b/);
});

test("help text names the command and the output rules", () => {
  const text = helpText();
  assert.match(text, /^yf-tree /);
  for (const flag of [
    "--format",
    "--depth",
    "--out",
    "--stamp",
    "--ignore",
    "--no-default-ignore",
    "--no-gitignore",
    "--dirs-only",
    "--max-children",
  ]) {
    assert.match(text, new RegExp(flag));
  }
  assert.match(text, /N more/);
  assert.match(text, /not followed/);
  assert.match(text, /yf-dump/);
});
