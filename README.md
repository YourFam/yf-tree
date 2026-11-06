# yf-tree

Write a directory tree. Markdown is a fenced tree. HTML is one self-contained dark page with expand and collapse.

This does not write file contents. That is `yf-dump`. Node 20+.

- **Source / README:** https://github.com/YourFam/yf-tree
- **npm:** https://www.npmjs.com/package/@yourfam/yf-tree
- **Unscoped alias:** https://www.npmjs.com/package/yf-git-tree
- **Issues:** https://github.com/YourFam/yf-tree/issues

## Install

```bash
npm install -g @yourfam/yf-tree
```

Then from any directory:

```bash
yf-tree
```

The command is `yf-tree`. No install:

```bash
npx @yourfam/yf-tree
npx yf-git-tree
```

`npx yf-git-tree` is the unscoped alias of `@yourfam/yf-tree` (same CLI, same version). npm rejects unscoped `yf-tree` as too similar to existing `rc-tree`. After `-g`, the command is `yf-tree`.

| | `npm install -g @yourfam/yf-tree` | `npm install -D @yourfam/yf-tree` |
|---|---|---|
| Where it goes | Global npm prefix | `node_modules/` of the current repo |
| Command | `yf-tree` from any folder | `npx yf-tree` in that repo |
| Typical use | A CLI you want everywhere | A tool this repo runs in scripts |

With `-D`, plain `yf-tree` is not on your PATH. Use `npx yf-tree`.

## Usage

```bash
yf-tree [path]
```

`path` defaults to `.`. `yf-tree apps/web` scans that folder. The output file is still written relative to where you ran the command.

```bash
yf-tree
yf-tree apps/web --format html
yf-tree --depth 2 --out docs
yf-tree --out - 
yf-tree --stamp --ignore dist --ignore "*.log"
```

| Option | Default | What it does |
|---|---|---|
| `path` | `.` | Directory to scan |
| `--format` | `md` | `md` or `html`. The file extension does not change the format |
| `--depth` | No limit | Positive integer. `--depth 1` is the root plus its immediate children. Deeper levels are omitted |
| `--out` | `./yf-tree-out/tree.md` or `tree.html` | A file, a directory, or `-` |
| `--stamp` | Off. The same file is replaced | On. The name gains a local timestamp: `tree-2026-11-05-143022.md` |
| `--ignore` | Nothing extra | Repeatable name or glob, on top of the built-in skips |
| `--no-default-ignore` | Built-in skips are on | Turn those skips off |
| `--no-gitignore` | `.gitignore` in the scanned tree is honored | Also list paths that Git ignores |
| `--dirs-only` | Files and directories | Directories only |
| `--max-children` | No cap | Max entries kept per folder. The rest become one line, `N more` |
| `--help`, `-h` | | Usage |
| `--version`, `-V` | | Package version |

`--out docs/tree.md` writes that file. `--out docs` writes `docs/tree.md` or `docs/tree.html`. A path that already exists as a directory is a directory. A new path whose last segment has an extension is a file. `--out -` prints to the terminal and does not write a file. `--stamp` applies to the default folder and to `--out`. It does not change stdout.

If the output file sits inside the scanned tree, that file is left out of the listing.

## What is skipped

A `.gitignore` in the scanned tree is honored, including nested ones. `.gitignore` files above the path you scanned are not read. An ignored directory is not opened, so a negation inside it cannot bring files back.

These directory names are always hidden, including when there is no Git ignore:

| Kind | Names |
|---|---|
| Version control | `.git`, `.svn`, `.hg` |
| JavaScript | `node_modules`, `bower_components`, `.pnp` |
| Python | `__pycache__`, `.venv`, `venv`, `.tox`, `.pytest_cache`, `.mypy_cache`, `.ruff_cache` |
| JS framework cache | `.next`, `.nuxt`, `.turbo`, `.cache`, `.parcel-cache`, `.expo` |
| Test output | `coverage`, `htmlcov`, `.nyc_output` |

These files are hidden anywhere: `.DS_Store`, `Thumbs.db`, `desktop.ini`, `*.pyc`.

`dist`, `build`, `out`, `output`, `public`, `target`, `bin`, `obj`, `vendor`, `Pods`, `.vscode`, `.idea`, `.github`, and `.env` are not hardcoded. Those names are source in some projects. `.gitignore` and `--ignore` cover them. A tree still shows that `.env` exists. Hiding file contents belongs to `yf-dump`.

Dotfiles other than the skips above stay visible. `--no-default-ignore` turns the built-in names off. `.gitignore` and `--ignore` still apply.

## Listing

Directories first, then files, A to Z, case insensitive. Symlinks are listed (`name -> target`) and not followed.

Markdown:

````
```text
.
├── src
│   └── index.js
└── README.md
```
````

HTML is one page: dark background, directories expand and collapse, buttons for expand all and collapse all. It does not color or badge files by type. The page has no external assets.

## Development

```bash
git clone https://github.com/YourFam/yf-tree.git
cd yf-tree
npm test
node ./bin/yf-tree.js --help
```

Maintainer: YourFam (`kamal-yourfam` on npm). MIT.

## Publish the unscoped alias (maintainers)

The GitHub repo publishes two npm packages at the same version:

1. `npm publish --access public` from the repo root → `@yourfam/yf-tree`
2. Then from `alias/`, with matching `version` and `dependencies["@yourfam/yf-tree"]`:

```bash
cd alias
npm publish --access public
```

That second package is named `yf-git-tree` and only shims the scoped CLI so `npx yf-git-tree` cannot be squatted. npm will not accept unscoped `yf-tree` (too similar to `rc-tree`).

## License

MIT © 2026 YourFam. See [LICENSE](./LICENSE).
