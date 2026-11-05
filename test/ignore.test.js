import assert from "node:assert/strict";
import { test } from "node:test";
import {
  decideIgnore,
  isDefaultSkipped,
  isIgnored,
  parseGitignore,
} from "../src/ignore.js";

test("built-in skips are directory names or the file list", () => {
  assert.equal(isDefaultSkipped("node_modules", true), true);
  assert.equal(isDefaultSkipped("Node_Modules", true), true);
  assert.equal(isDefaultSkipped("node_modules", false), false);
  assert.equal(isDefaultSkipped("node_modules_backup", true), false);
  assert.equal(isDefaultSkipped("coverage", true), true);
  assert.equal(isDefaultSkipped("coverage", false), false);
  assert.equal(isDefaultSkipped(".DS_Store", false), true);
  assert.equal(isDefaultSkipped("Thumbs.db", false), true);
  assert.equal(isDefaultSkipped("foo.pyc", false), true);
  assert.equal(isDefaultSkipped("Foo.PYC", false), true);
  assert.equal(isDefaultSkipped("foo.py", false), false);
  assert.equal(isDefaultSkipped("dist", true), false);
  assert.equal(isDefaultSkipped(".env", false), false);
  assert.equal(isDefaultSkipped(".git", true), true);
});

test("gitignore comments, blanks, globs, anchors, and directory slashes", () => {
  const rules = parseGitignore(`
# comment
*.log

/top
nested/file.txt
build/
foo/**
**/*.tmp
`);
  assert.equal(decideIgnore("a.log", false, rules).ignored, true);
  assert.equal(decideIgnore("dir/a.log", false, rules).ignored, true);
  assert.equal(decideIgnore("keep.txt", false, rules).ignored, false);
  assert.equal(decideIgnore("top", true, rules).ignored, true);
  assert.equal(decideIgnore("src/top", true, rules).ignored, false);
  assert.equal(decideIgnore("nested/file.txt", false, rules).ignored, true);
  assert.equal(decideIgnore("nested/other.txt", false, rules).ignored, false);
  assert.equal(decideIgnore("build", true, rules).ignored, true);
  assert.equal(decideIgnore("src/build", true, rules).ignored, true);
  assert.equal(decideIgnore("build", false, rules).ignored, false);
  assert.equal(decideIgnore("foo", true, rules).ignored, false);
  assert.equal(decideIgnore("foo/a", false, rules).ignored, true);
  assert.equal(decideIgnore("foo/a/b.tmp", false, rules).ignored, true);
  assert.equal(decideIgnore("a.tmp", false, rules).ignored, true);
});

test("last matching rule wins, including a nested gitignore", () => {
  const parent = parseGitignore("*.log\n!keep.log\n");
  assert.equal(decideIgnore("keep.log", false, parent).ignored, false);
  assert.equal(decideIgnore("drop.log", false, parent).ignored, true);

  const nested = parent.concat(parseGitignore("!special.log\n", "sub"));
  assert.equal(decideIgnore("sub/special.log", false, nested).ignored, false);
  assert.equal(decideIgnore("sub/drop.log", false, nested).ignored, true);
  assert.equal(decideIgnore("other/special.log", false, nested).ignored, true);
});

test("--ignore is applied after gitignore", () => {
  const git = parseGitignore("*.log\n!keep.log\n");
  const extra = parseGitignore("*.log\n");
  assert.equal(isIgnored("keep.log", false, git, extra), true);
  assert.equal(isIgnored("notes.txt", false, git, extra), false);

  const unhide = parseGitignore("!keep.log\n");
  const hideLogs = parseGitignore("*.log\n");
  assert.equal(isIgnored("keep.log", false, hideLogs, unhide), false);
});

test("yarn-style un-ignore keeps the directory and not its ignored siblings", () => {
  const rules = parseGitignore(`
.yarn/*
!.yarn/patches
!.yarn/releases
`);
  assert.equal(decideIgnore(".yarn", true, rules).ignored, false);
  assert.equal(decideIgnore(".yarn/cache", true, rules).ignored, true);
  assert.equal(decideIgnore(".yarn/patches", true, rules).ignored, false);
  assert.equal(decideIgnore(".yarn/patches/one.patch", false, rules).ignored, false);
  assert.equal(decideIgnore(".yarn/releases/pkg", true, rules).ignored, false);
});

test("one-character glob matches a basename anywhere", () => {
  const rules = parseGitignore("?\n");
  assert.equal(decideIgnore("a", false, rules).ignored, true);
  assert.equal(decideIgnore("ab/c", false, rules).ignored, true);
  assert.equal(decideIgnore("ab", false, rules).ignored, false);
  assert.equal(decideIgnore("ab/cd", false, rules).ignored, false);
});
