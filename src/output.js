import { statSync } from "node:fs";
import path from "node:path";

/**
 * @param {string} filename
 * @param {Date} date
 */
export function stampName(filename, date) {
  const ext = path.extname(filename);
  const stem = ext ? filename.slice(0, filename.length - ext.length) : filename;
  const p = (n) => String(n).padStart(2, "0");
  const day = [date.getFullYear(), p(date.getMonth() + 1), p(date.getDate())].join("-");
  const time = `${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
  return `${stem}-${day}-${time}${ext}`;
}

/**
 * @param {string} input
 */
export function displayPath(input) {
  const clean = input.replaceAll("\\", "/").replace(/\/+$/, "");
  return clean === "" ? "." : clean;
}

/**
 * @param {string} abs
 * @param {string} raw
 */
function isDirectoryOutput(abs, raw) {
  if (raw.endsWith("/") || raw.endsWith("\\")) return true;
  try {
    return statSync(abs).isDirectory();
  } catch {
    const base = path.basename(abs);
    return base.lastIndexOf(".") <= 0;
  }
}

/**
 * @param {{ cwd: string, format: "md" | "html", out: string | null, stamp: boolean, now: Date }} options
 * @returns {{ stdout: boolean, filePath: string | null }}
 */
export function resolveOutput(options) {
  const ext = options.format === "html" ? ".html" : ".md";
  const plain = `tree${ext}`;
  const name = options.stamp ? stampName(plain, options.now) : plain;

  if (options.out == null) {
    return { stdout: false, filePath: path.resolve(options.cwd, "yf-tree-out", name) };
  }
  if (options.out === "-") return { stdout: true, filePath: null };

  const abs = path.resolve(options.cwd, options.out);
  if (isDirectoryOutput(abs, options.out)) {
    return { stdout: false, filePath: path.join(abs, name) };
  }
  if (!options.stamp) return { stdout: false, filePath: abs };
  return {
    stdout: false,
    filePath: path.join(path.dirname(abs), stampName(path.basename(abs), options.now)),
  };
}

/**
 * Posix path of filePath relative to root when the file is inside the scan.
 * Null when the output is the root itself or lives outside it.
 * @param {string} root
 * @param {string} filePath
 * @returns {string | null}
 */
export function relativeInside(root, filePath) {
  const rel = path.relative(path.resolve(root), path.resolve(filePath));
  if (rel === "" || rel === ".") return null;
  if (path.isAbsolute(rel)) return null;
  if (rel.split(path.sep).includes("..")) return null;
  return rel.split(path.sep).join("/");
}

/**
 * @param {string} cwd
 * @param {string} filePath
 */
export function displayWritten(cwd, filePath) {
  const rel = path.relative(cwd, filePath);
  const outside = !rel || rel.split(path.sep).includes("..") || path.isAbsolute(rel);
  const shown = outside ? filePath : rel;
  return shown.split(path.sep).join("/");
}
