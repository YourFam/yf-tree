/**
 * @typedef {import("./walk.js").Node} Node
 */

/**
 * @param {Node} node
 */
function labelOf(node) {
  if (node.kind === "symlink") {
    return node.target ? `${node.name} -> ${node.target}` : node.name;
  }
  return node.name;
}

/**
 * @param {string} body
 */
function fence(body) {
  let size = 3;
  while (body.includes("`".repeat(size))) size += 1;
  const tick = "`".repeat(size);
  return `${tick}text\n${body}\n${tick}\n`;
}

/**
 * @param {string[]} lines
 * @param {Node[]} nodes
 * @param {string} prefix
 */
function appendLines(lines, nodes, prefix) {
  nodes.forEach((node, index) => {
    const last = index === nodes.length - 1;
    lines.push(`${prefix}${last ? "└── " : "├── "}${labelOf(node)}`);
    if (node.kind === "dir" && node.children && node.children.length > 0) {
      appendLines(lines, node.children, `${prefix}${last ? "    " : "│   "}`);
    }
  });
}

/**
 * @param {string} rootLabel
 * @param {Node[]} nodes
 */
export function renderMarkdown(rootLabel, nodes) {
  /** @type {string[]} */
  const lines = [rootLabel];
  appendLines(lines, nodes, "");
  return fence(lines.join("\n"));
}

/**
 * @param {Node[]} nodes
 */
function tally(nodes) {
  let dirs = 0;
  let files = 0;
  for (const node of nodes) {
    if (node.kind === "dir") {
      dirs += 1;
      if (node.children) {
        const inner = tally(node.children);
        dirs += inner.dirs;
        files += inner.files;
      }
    } else if (node.kind === "file" || node.kind === "symlink") {
      files += 1;
    }
  }
  return { dirs, files };
}

/**
 * @param {number} count
 * @param {string} one
 * @param {string} many
 */
function noun(count, one, many) {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * @param {string} value
 */
function esc(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/**
 * @param {Node[]} nodes
 * @param {string[]} parts
 */
function appendHtml(nodes, parts) {
  parts.push("<ul>");
  for (const node of nodes) {
    if (node.kind === "dir" && node.children && node.children.length > 0) {
      parts.push("<li class=\"dir\"><details open><summary>");
      parts.push(esc(node.name));
      parts.push("</summary>");
      appendHtml(node.children, parts);
      parts.push("</details></li>");
      continue;
    }
    if (node.kind === "dir") {
      parts.push(`<li class="dir leaf">${esc(node.name)}</li>`);
      continue;
    }
    if (node.kind === "symlink") {
      const target = node.target ? ` <span class="target">-&gt; ${esc(node.target)}</span>` : "";
      parts.push(`<li class="symlink">${esc(node.name)}${target}</li>`);
      continue;
    }
    if (node.kind === "more") {
      parts.push(`<li class="more">${esc(node.name)}</li>`);
      continue;
    }
    if (node.kind === "unreadable") {
      parts.push(`<li class="unreadable">${esc(node.name)}</li>`);
      continue;
    }
    parts.push(`<li class="file">${esc(node.name)}</li>`);
  }
  parts.push("</ul>");
}

const CSS = `
:root {
  color-scheme: dark;
  --bg: #10141a;
  --panel: #171c24;
  --line: #2c3644;
  --text: #e8edf2;
  --muted: #8b97a6;
  --accent: #9ebfff;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  min-height: 100vh;
  background: var(--bg);
  color: var(--text);
  font: 15px/1.5 "Segoe UI", system-ui, sans-serif;
}
main { max-width: 920px; margin: 0 auto; padding: 28px 20px 48px; }
header { display: flex; justify-content: space-between; gap: 16px; align-items: flex-end; margin-bottom: 16px; }
h1 { margin: 0; font-size: 1.35rem; font-weight: 650; letter-spacing: 0.01em; word-break: break-all; }
.meta { margin: 4px 0 0; color: var(--muted); }
.controls { display: flex; gap: 8px; flex-shrink: 0; }
button {
  background: #222a36;
  color: var(--text);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 6px 10px;
  font: inherit;
  cursor: pointer;
}
button:hover { border-color: var(--accent); }
.tree {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 14px 16px 16px;
  font-family: "Cascadia Code", "SFMono-Regular", ui-monospace, monospace;
  font-size: 13.5px;
  line-height: 1.45;
}
ul { list-style: none; margin: 0; padding-left: 1.15rem; }
.tree > ul { padding-left: 0; }
li { margin: 1px 0; }
summary { cursor: pointer; }
summary::-webkit-details-marker { display: none; }
summary::before, .leaf::before, .file::before, .symlink::before, .more::before, .unreadable::before {
  display: inline-block;
  width: 1.1em;
  color: var(--muted);
}
summary::before { content: "▸"; }
details[open] > summary::before { content: "▾"; }
.leaf::before, .file::before, .symlink::before, .more::before, .unreadable::before { content: ""; }
.dir > summary, .leaf { color: var(--text); font-weight: 650; }
.file, .symlink { color: var(--text); font-weight: 400; }
.target, .more, .unreadable { color: var(--muted); font-weight: 400; }
`.trim();

const SCRIPT = `
function setOpen(open) {
  document.querySelectorAll("details").forEach((node) => {
    node.open = open;
  });
}
document.getElementById("expand").addEventListener("click", () => setOpen(true));
document.getElementById("collapse").addEventListener("click", () => setOpen(false));
`.trim();

/**
 * One dark page. Directories with children expand and collapse.
 * Deeper levels that were omitted are not given a toggle.
 * @param {string} rootLabel
 * @param {Node[]} nodes
 */
export function renderHtml(rootLabel, nodes) {
  const counts = tally(nodes);
  const parts = [];
  appendHtml(nodes, parts);
  const safeLabel = esc(rootLabel);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<title>tree · ${safeLabel}</title>
<style>
${CSS}
</style>
</head>
<body>
<main>
<header>
<div>
<h1>${safeLabel}</h1>
<p class="meta">${noun(counts.dirs, "directory", "directories")} · ${noun(counts.files, "file", "files")}</p>
</div>
<div class="controls">
<button type="button" id="expand">Expand all</button>
<button type="button" id="collapse">Collapse all</button>
</div>
</header>
<div class="tree">
${parts.join("")}
</div>
</main>
<script>
${SCRIPT}
</script>
</body>
</html>
`;
}
