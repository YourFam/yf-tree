import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { displayPath, relativeInside, resolveOutput, stampName } from "../src/output.js";
import { remove, tempDir } from "./helpers.js";

const now = new Date(2026, 10, 5, 14, 30, 22);

test("stamp uses local time before the extension", () => {
  assert.equal(stampName("tree.md", now), "tree-2026-11-05-143022.md");
  assert.equal(stampName("my-tree.html", now), "my-tree-2026-11-05-143022.html");
  assert.equal(stampName("tree.spec.md", now), "tree.spec-2026-11-05-143022.md");
});

test("display path keeps the path you passed", () => {
  assert.equal(displayPath("."), ".");
  assert.equal(displayPath("apps/web/"), "apps/web");
  assert.equal(displayPath("apps\\web"), "apps/web");
});

test("resolve output file, directory, stdout, and stamp", () => {
  const cwd = tempDir();
  try {
    const base = { cwd, now, stamp: false };
    assert.equal(resolveOutput({ ...base, format: "md", out: null }).filePath, path.resolve(cwd, "yf-tree-out", "tree.md"));
    assert.equal(
      resolveOutput({ ...base, format: "html", out: null }).filePath,
      path.resolve(cwd, "yf-tree-out", "tree.html"),
    );
    assert.equal(resolveOutput({ ...base, format: "md", out: "-" }).stdout, true);

    assert.equal(
      resolveOutput({ ...base, format: "html", out: "docs/tree.md" }).filePath,
      path.resolve(cwd, "docs", "tree.md"),
    );
    assert.equal(
      resolveOutput({ ...base, format: "md", out: "docs" }).filePath,
      path.resolve(cwd, "docs", "tree.md"),
    );
    assert.equal(
      resolveOutput({ ...base, format: "html", out: "docs/" }).filePath,
      path.resolve(cwd, "docs", "tree.html"),
    );

    mkdirSync(path.join(cwd, "existing"));
    assert.equal(
      resolveOutput({ ...base, format: "md", out: "existing" }).filePath,
      path.resolve(cwd, "existing", "tree.md"),
    );

    const stamped = resolveOutput({ ...base, format: "md", out: "docs/custom.md", stamp: true });
    assert.equal(stamped.filePath, path.resolve(cwd, "docs", "custom-2026-11-05-143022.md"));
    const stampedDir = resolveOutput({ ...base, format: "html", out: null, stamp: true });
    assert.equal(stampedDir.filePath, path.resolve(cwd, "yf-tree-out", "tree-2026-11-05-143022.html"));
  } finally {
    remove(cwd);
  }
});

test("relativeInside is null outside the scan and set for a file inside it", () => {
  const root = path.resolve("/work/app");
  assert.equal(relativeInside(root, path.resolve("/work/app/yf-tree-out/tree.md")), "yf-tree-out/tree.md");
  assert.equal(relativeInside(root, path.resolve("/work/other/tree.md")), null);
  assert.equal(relativeInside(root, root), null);
});
