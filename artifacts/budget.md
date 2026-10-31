# Submission path budget

The recursive dependency/cache exclusions in `.gitignore` remain in place; `dist/` remains included. Explicit exceptions include only the named review documents, response JSON and five screenshots below, ensuring they travel with the submission. All other `artifacts/` paths remain excluded. Test scratch files are disposable and excluded. No dependency directory, package-manager cache, registry mirror, tarball, submodule or source map is included.

| Delivered path | Maximum budget |
| --- | ---: |
| `src/` | 524288 bytes |
| `test/browser.mjs` | 65536 bytes |
| `package.json`, `package-lock.json` | 131072 bytes together |
| `index.html`, `vite.config.ts`, `tsconfig.json`, `.gitignore` | 16384 bytes together |
| `README.md`, `DESIGN.md` | 65536 bytes together |
| `public/` | 131072 bytes |
| `dist/` (complete production export) | 1048576 bytes |
| `artifacts/` (review, licenses, check reports and five screenshots) | 2097152 bytes |
| `.imd-responses.json` | 16384 bytes |

Sum of path ceilings: **4096000 bytes (under 4 MiB)**, below the task's **8388608-byte** cap. Actual delivered-path totals are recorded below. All source, locked dependencies and required local runtime assets remain complete; dependency installation is external to the submission.

- `src/`: 166394 bytes
- `test/`: 34566 bytes
- `public/`: 71895 bytes
- `dist/`: 352288 bytes
- `artifacts/`: 445147 bytes
- Root source/configuration/docs/responses: 76226 bytes
- Entire delivered tree: **1146516 bytes** across 44 files, including the full export and retained screenshots. This conservatively bounds the revision additions.
