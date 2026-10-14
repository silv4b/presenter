# AGENTS.md

Guidelines for agents working in this repository.

## Batch Commits

Whenever there are multiple unrelated changes, organize them into independent commits, each following the semantic-release convention (in Portuguese):

- `feat:` — new features
- `fix:` — bug fixes
- `chore:` — maintenance tasks (formatting, lint, dependencies)
- `ci:` — changes to GitHub Actions workflows
- `style:` — formatting with no behavior change
- `docs:` — documentation changes
- `refactor:` — refactors with no behavior change
- `test:` — adding or adjusting tests

Rules:

1. Group related changes into the same commit; split changes of different natures.
2. Write the message in Portuguese, concise, in the imperative mood.
3. If changes to the same file are of different natures (e.g., `feat` and `fix` interleaved in the same file), combine them into a single coherent commit.
4. Do not commit unless the user explicitly asks.
5. Before committing, run the verification described below.

## Verification

Run the verification after every change and before a commit or PR:

- Frontend types and build: `npm run typecheck && npx vite build`
  - `npm run typecheck` covers `tsconfig.json` and `tsconfig.node.json` (the
    second one type-checks `vite.config.ts`).
  - If `npx` is unavailable in the environment, use the local binaries:
    `.\node_modules\.bin\tsc.cmd --noEmit`,
    `.\node_modules\.bin\tsc.cmd -p tsconfig.node.json --noEmit` and
    `.\node_modules\.bin\vite.cmd build`.
- Rust formatting: `cargo fmt --manifest-path src-tauri\Cargo.toml -- --check`
- Rust backend: `cargo check --manifest-path src-tauri\Cargo.toml`
  - Only required when the change touches `src-tauri/`.
- Lint and automated tests: not configured in this project. Do not invent commands.

Notes:

- `npm run clean:tauri` fails while `presenter.exe` is running (file lock on Windows).
- When changing versions in `src-tauri/Cargo.toml`, sync `Cargo.lock` with `cargo update --manifest-path src-tauri\Cargo.toml -p <crate>`.
