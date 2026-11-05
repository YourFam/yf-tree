import assert from "node:assert/strict";
import { test } from "node:test";
import { renderHtml, renderMarkdown } from "../src/render.js";

const nodes = [
  {
    kind: "dir",
    name: "A",
    children: [{ kind: "file", name: "file.txt" }],
  },
  {
    kind: "dir",
    name: "b",
    children: [{ kind: "file", name: "file.txt" }],
  },
  { kind: "file", name: "A.js" },
  { kind: "file", name: "b.js" },
];

test("markdown is a fenced tree, directories first", () => {
  assert.equal(
    renderMarkdown(".", nodes),
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
});

test("markdown shows symlink targets, omitted rows, and a longer fence when needed", () => {
  const body = renderMarkdown("apps/web", [
    { kind: "symlink", name: "link", target: "../x" },
    { kind: "more", name: "2 more" },
    { kind: "file", name: "has```ticks" },
  ]);
  assert.match(body, /^````text\n/);
  assert.match(body, /└── has```ticks\n````\n$/);
  assert.match(body, /link -> \.\.\/x/);
  assert.match(body, /2 more/);
});

test("html is one dark page with expand and collapse and no type badges", () => {
  const html = renderHtml("apps/web", [
    {
      kind: "dir",
      name: "src",
      children: [{ kind: "file", name: "<b>.txt" }],
    },
    { kind: "dir", name: "empty", children: [] },
    { kind: "symlink", name: "link", target: "src" },
    { kind: "more", name: "3 more" },
  ]);
  assert.match(html, /^<!DOCTYPE html>/);
  assert.match(html, /<title>tree · apps\/web<\/title>/);
  assert.match(html, /--bg: #10141a/);
  assert.match(html, /<details open><summary>src<\/summary>/);
  assert.match(html, /&lt;b&gt;\.txt/);
  assert.match(html, /<li class="dir leaf">empty<\/li>/);
  assert.match(html, /id="expand"/);
  assert.match(html, /id="collapse"/);
  assert.match(html, /Expand all/);
  assert.match(html, /Collapse all/);
  assert.match(html, /3 more/);
  assert.match(html, /2 directories · 2 files/);
  assert.doesNotMatch(html, /https?:/);
  assert.doesNotMatch(html, /badge|pill|typescript|javascript/i);
  assert.match(html, /<style>/);
  assert.match(html, /<script>/);
});
