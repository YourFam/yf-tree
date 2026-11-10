import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, symlinkSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { DEFAULT_SKIP_DIRS } from "../src/ignore.js";
import { entryNames, remove, run, tempDir, writeRel } from "./helpers.js";

test("bin --version prints the package version", () => {
  const bin = fileURLToPath(new URL("../bin/yf-tree.js", import.meta.url));
  const result = spawnSync(process.execPath, [bin, "--version"], { encoding: "utf8", windowsHide: true });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /^0\.1\.0\b/);
});

test("help does not need a directory", () => {
  const missing = path.join(tempDir(), "nope");
  const result = run(["--help"], missing);
  assert.equal(result.code, 0);
  assert.match(result.out, /^yf-tree /);
});

test("missing path and a file path fail", () => {
  const dir = tempDir();
  try {
    writeRel(dir, "file.txt", "x");
    const missing = run(["nope"], dir);
    assert.equal(missing.code, 1);
    assert.match(missing.err, /Path not found: nope/);
    const file = run(["file.txt"], dir);
    assert.equal(file.code, 1);
    assert.match(file.err, /Not a directory: file\.txt/);
  } finally {
    remove(dir);
  }
});

test("directories first, then files, case insensitive", () => {
  const dir = tempDir();
  try {
    writeRel(dir, "b/file.txt", "");
    writeRel(dir, "A/file.txt", "");
    writeRel(dir, "b.js", "");
    writeRel(dir, "A.js", "");
    const result = run(["--out", "-"], dir);
    assert.equal(result.code, 0);
    assert.equal(
      result.out,
      [
        "```text",
        ".",
        "├── A",
        "│   └── file.txt",
        "├── b",
        "│   └── file.txt",
        "├── A.js",
        "└── b.js",
        "```",
        "",
      ].join("\n"),
    );
  } finally {
    remove(dir);
  }
});

test("depth omits deeper levels", () => {
  const dir = tempDir();
  try {
    writeRel(dir, "a/b/c.txt", "");
    writeRel(dir, "a/d.txt", "");
    writeRel(dir, "e.txt", "");
    const depth1 = run(["--out", "-", "--depth", "1"], dir);
    assert.equal(depth1.out, ["```text", ".", "├── a", "└── e.txt", "```", ""].join("\n"));
    const depth2 = run(["--out", "-", "--depth", "2"], dir);
    assert.equal(
      depth2.out,
      ["```text", ".", "├── a", "│   ├── b", "│   └── d.txt", "└── e.txt", "```", ""].join("\n"),
    );
  } finally {
    remove(dir);
  }
});

test("max-children keeps directories first and summarizes the rest", () => {
  const dir = tempDir();
  try {
    writeRel(dir, "a/b/c.txt", "");
    writeRel(dir, "a/z/hidden.txt", "");
    writeRel(dir, "a/d.txt", "");
    const result = run(["--out", "-", "--max-children", "1"], dir);
    assert.equal(
      result.out,
      [
        "```text",
        ".",
        "└── a",
        "    ├── b",
        "    │   └── c.txt",
        "    └── 2 more",
        "```",
        "",
      ].join("\n"),
    );
  } finally {
    remove(dir);
  }
});

test("dirs-only drops files", () => {
  const dir = tempDir();
  try {
    writeRel(dir, "a/b/c.txt", "");
    writeRel(dir, "e.txt", "");
    writeRel(dir, "empty/.keep", "");
    const result = run(["--out", "-", "--dirs-only"], dir);
    assert.equal(
      result.out,
      ["```text", ".", "├── a", "│   └── b", "└── empty", "```", ""].join("\n"),
    );
  } finally {
    remove(dir);
  }
});

test("built-in skips, gitignore, and paths that must stay visible", () => {
  const dir = tempDir();
  try {
    for (const name of DEFAULT_SKIP_DIRS) {
      writeRel(dir, `${name}/SECRET_DIR.txt`, "");
    }
    writeRel(dir, ".DS_Store", "");
    writeRel(dir, "src/Thumbs.db", "");
    writeRel(dir, "src/desktop.ini", "");
    writeRel(dir, "src/a.pyc", "");
    writeRel(dir, "src/Foo.PYC", "");
    writeRel(dir, "src/a.py", "");
    writeRel(dir, "dist/keep.txt", "");
    writeRel(dir, ".env", "SECRET=1");
    writeRel(dir, "public/index.html", "");
    writeRel(dir, "node_modules_backup/keep.txt", "");
    writeRel(dir, ".gitignore", "dist/\n*.html\n");
    writeRel(dir, "kept.log", "");

    const result = run(["--out", "-"], dir);
    assert.equal(result.code, 0);
    const names = entryNames(result.out);
    assert.equal(result.out.includes("SECRET_DIR"), false);
    assert.equal(names.includes("node_modules"), false);
    assert.equal(names.includes(".git"), false);
    assert.equal(names.includes(".DS_Store"), false);
    assert.equal(names.includes("Thumbs.db"), false);
    assert.equal(names.includes("a.pyc"), false);
    assert.equal(names.includes("Foo.PYC"), false);
    assert.equal(names.includes("dist"), false);
    assert.equal(names.includes("index.html"), false);
    assert.ok(names.includes(".env"));
    assert.ok(names.includes("a.py"));
    assert.ok(names.includes("node_modules_backup"));
    assert.ok(names.includes("public"));
    assert.ok(names.includes("keep.txt"));
    assert.ok(names.includes("kept.log"));
    assert.doesNotMatch(result.out, /SECRET=1/);

    const shown = run(["--out", "-", "--no-default-ignore", "--no-gitignore"], dir);
    const shownNames = entryNames(shown.out);
    assert.ok(shownNames.includes("node_modules"));
    assert.ok(shownNames.includes("SECRET_DIR.txt"));
    assert.ok(shownNames.includes("dist"));
    assert.ok(shownNames.includes(".DS_Store"));
  } finally {
    remove(dir);
  }
});

test("nested gitignore negation and --ignore on top", () => {
  const dir = tempDir();
  try {
    writeRel(dir, ".gitignore", "*.log\nsecret/\n");
    writeRel(dir, "sub/.gitignore", "!special.log\n");
    writeRel(dir, "sub/special.log", "");
    writeRel(dir, "sub/drop.log", "");
    writeRel(dir, "secret/keep.txt", "");
    writeRel(dir, "visible.txt", "");

    const result = run(["--out", "-"], dir);
    const names = entryNames(result.out);
    assert.ok(names.includes("special.log"));
    assert.equal(names.includes("drop.log"), false);
    assert.equal(names.includes("secret"), false);
    assert.equal(result.out.includes("keep.txt"), false);
    assert.ok(names.includes("visible.txt"));

    const extra = run(["--out", "-", "--ignore", "*.log"], dir);
    assert.equal(entryNames(extra.out).includes("special.log"), false);

    const noGit = run(["--out", "-", "--no-gitignore"], dir);
    assert.ok(entryNames(noGit.out).includes("drop.log"));
    assert.ok(entryNames(noGit.out).includes("secret"));
    assert.ok(entryNames(noGit.out).includes("keep.txt"));
  } finally {
    remove(dir);
  }
});

test("default ignore wins over a gitignore negation", () => {
  const dir = tempDir();
  try {
    writeRel(dir, ".gitignore", "!node_modules\n!node_modules/**\n");
    writeRel(dir, "node_modules/pkg/index.js", "");
    const result = run(["--out", "-"], dir);
    assert.equal(result.out.includes("node_modules"), false);
    assert.equal(result.out.includes("index.js"), false);
  } finally {
    remove(dir);
  }
});

test("output is written next to the shell, and that file is left out of the scan", () => {
  const cwd = tempDir();
  try {
    writeRel(cwd, "apps/web/src/a.js", "");
    writeRel(cwd, "apps/web/yf-tree-out/tree.md", "old");

    const scanned = run(["apps/web"], cwd);
    assert.equal(scanned.code, 0);
    assert.match(scanned.err, /wrote yf-tree-out\/tree\.md/);
    const written = readFileSync(path.join(cwd, "yf-tree-out", "tree.md"), "utf8");
    assert.match(written, /apps\/web/);
    assert.match(written, /a\.js/);
    assert.equal(readFileSync(path.join(cwd, "apps", "web", "yf-tree-out", "tree.md"), "utf8"), "old");

    writeRel(cwd, "yf-tree-out/keep.txt", "");
    const local = run(["."], cwd);
    assert.match(local.err, /wrote yf-tree-out\/tree\.md/);
    const body = readFileSync(path.join(cwd, "yf-tree-out", "tree.md"), "utf8");
    assert.match(body, /└── yf-tree-out\n {4}└── keep\.txt/);
    assert.ok(entryNames(body).includes("apps"));
    assert.equal(entryNames(body).filter((name) => name === "tree.md").length, 1);
  } finally {
    remove(cwd);
  }
});

test("--out file, directory, stdout, stamp, and html", () => {
  const dir = tempDir();
  try {
    writeRel(dir, "src/a.js", "");
    const file = run(["--format", "html", "--out", "docs/tree.md"], dir);
    assert.equal(file.code, 0);
    const html = readFileSync(path.join(dir, "docs", "tree.md"), "utf8");
    assert.match(html, /^<!DOCTYPE html>/);
    assert.match(html, /<details open>/);
    assert.doesNotMatch(file.err, /tree\.html/);

    const folder = run(["--format", "html", "--out", "site", "--stamp"], dir);
    assert.match(folder.err, /wrote site\/tree-2026-11-05-143022\.html/);
    const stamped = readFileSync(path.join(dir, "site", "tree-2026-11-05-143022.html"), "utf8");
    assert.match(stamped, /Expand all/);

    const stdout = run(["--out", "-"], dir);
    assert.match(stdout.out, /```text/);
    assert.equal(stdout.err, "");
  } finally {
    remove(dir);
  }
});

test("symlinks are listed and not followed", () => {
  const dir = tempDir();
  try {
    writeRel(dir, "real/secret.txt", "");
    const link = path.join(dir, "link");
    try {
      symlinkSync(path.join(dir, "real"), link, "dir");
    } catch (err) {
      const code = err && /** @type {{ code?: string }} */ (err).code;
      if (code === "EPERM" || code === "EACCES") return;
      throw err;
    }
    const result = run(["--out", "-"], dir);
    assert.match(result.out, /link -> /);
    assert.equal(result.out.includes("secret.txt"), false);
  } finally {
    remove(dir);
  }
});

test("second run replaces the same file", () => {
  const dir = tempDir();
  try {
    writeRel(dir, "a.txt", "");
    assert.equal(run([], dir).code, 0);
    writeRel(dir, "b.txt", "");
    assert.equal(run([], dir).code, 0);
    const body = readFileSync(path.join(dir, "yf-tree-out", "tree.md"), "utf8");
    assert.match(body, /a\.txt/);
    assert.match(body, /b\.txt/);
  } finally {
    remove(dir);
  }
});

test("--gitignore writes the root .gitignore and does not duplicate", () => {
  const root = tempDir();
  try {
    writeRel(root, ".git/HEAD", "ref: refs/heads/main\n");
    writeRel(root, "sub/a.txt", "");
    writeRel(root, ".gitignore", "node_modules/\n");

    const first = run(["--gitignore", "--out", "-"], path.join(root, "sub"));
    assert.equal(first.code, 0);
    assert.match(first.err, /added yf-tree-out\/ to .*\/\.gitignore/);
    assert.equal(existsSync(path.join(root, "sub", ".gitignore")), false);
    assert.equal(readFileSync(path.join(root, ".gitignore"), "utf8"), "node_modules/\nyf-tree-out/\n");

    const second = run(["--gitignore", "--out", "-"], root);
    assert.equal(second.code, 0);
    assert.match(second.err, /yf-tree-out\/ already in \.gitignore/);
    assert.equal(readFileSync(path.join(root, ".gitignore"), "utf8"), "node_modules/\nyf-tree-out/\n");
  } finally {
    remove(root);
  }
});

test("--gitignore creates a missing root .gitignore and accepts an anchored line", () => {
  const root = tempDir();
  try {
    writeRel(root, ".git/HEAD", "ref: refs/heads/main\n");
    writeRel(root, "a.txt", "");
    const created = run(["--gitignore", "--out", "-"], root);
    assert.equal(created.code, 0);
    assert.equal(readFileSync(path.join(root, ".gitignore"), "utf8"), "yf-tree-out/\n");

    writeRel(root, ".gitignore", "/yf-tree-out/\n");
    const present = run(["--gitignore", "--out", "-"], root);
    assert.match(present.err, /already in/);
    assert.equal(readFileSync(path.join(root, ".gitignore"), "utf8"), "/yf-tree-out/\n");
  } finally {
    remove(root);
  }
});

test("--gitignore fails outside a repository and a normal run does not touch .gitignore", () => {
  const dir = tempDir();
  try {
    writeRel(dir, "a.txt", "");
    const missing = run(["--gitignore", "--out", "-"], dir);
    assert.equal(missing.code, 1);
    assert.match(missing.err, /No git repository found/);
    assert.equal(existsSync(path.join(dir, ".gitignore")), false);

    writeRel(dir, ".git/HEAD", "ref: refs/heads/main\n");
    const plain = run(["--out", "-"], dir);
    assert.equal(plain.code, 0);
    assert.equal(existsSync(path.join(dir, ".gitignore")), false);
  } finally {
    remove(dir);
  }
});
