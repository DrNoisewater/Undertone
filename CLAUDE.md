# CLAUDE.md

<!--
HOW TO USE THIS FILE
- Global rules (sections 1–7) can live in ~/.claude/CLAUDE.md so they apply to every repo.
- Per-repo facts (section 8) belong in each project's own CLAUDE.md. That section is where most of the value is.
- Keep this file short. It is loaded into every session, so every line costs context. Delete anything Claude already does well without being told.
- Run /init in a new repo to have Claude draft section 8 from the codebase, then correct it by hand.
-->

## 1. Mission
- Deliver the requested behavior with the smallest reliable change that meets the acceptance criteria.
- Correctness, stability, and verified outcomes beat new features or clever architecture.
- Preserve existing working behavior unless the task explicitly changes it.

## 2. Before editing
- Restate the goal in one line if the request is ambiguous; ask only if a wrong guess would be costly.
- Run `git status` first. Changes you didn't make are the user's: never discard or overwrite them.
- Locate the owning code with targeted search (`rg --files`, `rg -n <symbol>`), then read only relevant files, their callers, and their tests.
- Check for an existing utility, pattern, or dependency before writing a new one.
- Skip generated files, build output, lockfiles, and large logs unless the task is about them.

## 3. Scope control
- Do exactly what was asked. No drive-by refactors, renames, reformatting, or "while I'm here" fixes.
- Notice an unrelated problem? Mention it in the handoff; don't fix it.
- Add a dependency only when it clearly beats a few lines of code. Ask before adding large ones.
- Touching a shared contract (API, schema, file format, public function)? Find and update every consumer and its tests.

## 4. Implementation standards
- Small, coherent, reviewable steps. Run a targeted check after each meaningful step.
- Never fake success: no stubs, mock responses, hardcoded happy paths, swallowed exceptions, or silently disabled features.
- Handle real-world failure: errors, cancellation, timeouts, concurrency, cleanup of files/handles/threads.
- UI work: match surrounding screens, keep the UI thread unblocked, show progress for long operations, no surprise dialogs or duplicate windows.
- Match the existing code style and naming even where you'd personally choose differently.

## 5. Bugs
- Reproduce first: a failing test, a script, or exact steps that show the bug.
- Find the root cause before changing code. Fix the cause, not the symptom.
- Keep the reproduction as a regression test when practical.
- If you can't reproduce it, say so and state your best hypothesis rather than guessing at a fix.

## 6. Verification (required)
- Order: focused test → affected subsystem tests → build/typecheck/lint → broader regression if the change is wide.
- Use only the commands in section 8. Don't invent commands.
- A failing test means diagnose and fix. Never weaken, skip, or delete a test to get green.
- A passing build is not proof a feature works. For UI, audio, file I/O, or hardware behavior, run the app when possible.
- Anything you couldn't check gets labeled **NOT VERIFIED** with the reason.

### Definition of done
- [ ] Requested behavior works, with evidence
- [ ] Edge cases and failure paths considered
- [ ] Existing behavior unchanged (tests pass)
- [ ] No debug code, commented-out blocks, or stray files left behind
- [ ] Handoff written (section 7)

## 7. Safety, stopping, and handoff

### Ask first before
- Deleting files or data, overwriting config, or anything irreversible
- `git push`, force-push, rebase, history rewrites, or branch deletion
- Installing large runtime dependencies, using paid services, or uploading anything externally
- Changing scope beyond the request

### Stop and report instead of pushing on when
- The same fix has failed twice. Step back, explain what you've learned, and propose options.
- The task turns out to be much bigger or riskier than it looked.
- Requirements conflict with existing behavior or with each other.

### Never
- Expose secrets or copy credentials/private data into code, logs, or reports.
- Invent test results, file paths, benchmarks, or completion status.

### Handoff format
1. **Changed:** files and what each change does
2. **Verified:** exact checks run and results; mark each item *implemented*, *tested*, or *verified in running app*
3. **Open:** limitations, NOT VERIFIED items, unrelated issues noticed

### Multi-session work
Keep a short `TASK_STATUS.md`: goal, done, remaining (specific), next verification step. Update it at natural checkpoints, not after every edit.


## 8. This project

**Stack:** TypeScript / Electron 41 / React 19 / electron-vite (Vite 7) / electron-builder. Speech-to-text runs in-process via `@huggingface/transformers` (Whisper ONNX); optional text cleanup goes through a local Ollama server. Windows (x64) is the main target; macOS is partially supported. Native helpers: C# (`native/UndertoneHelper.cs`, Windows) and Swift (`swift/OpenWhispHelper.swift`, macOS).

**Requirements:** Node.js 22.12 or later. Windows native helper needs the .NET Framework 4.8 `csc.exe` (present on windows-latest runners and most Windows PCs).

**Commands** (verified on Linux with Node 22 unless noted)
- Install: `npm ci`
- Type-check: `npm run typecheck`
- Build app (main/preload/renderer into `dist/`): `npm run build`
- Build native helper: `npm run build:native` (on Linux it just prints a skip message and exits 0)
- Run all tests: `npm test` (Node's built-in test runner, no extra framework)
- Run one test file: `node --experimental-strip-types --test tests/core.test.ts`
- Package, unpacked: `npx electron-builder --win dir --x64 --publish never` on Windows; on Linux `npx electron-builder --linux dir --publish never` only checks that packaging config works
- Full local Windows build plus installer: `BUILD.cmd` (Windows only)
- Launch in dev: `npm run dev` (needs a desktop; can't run in a headless Linux container)

**Layout**
- `src/main/` — Electron main process: dictation pipeline, transcription, Ollama client, prompts, settings, IPC, windows/tray
- `src/preload/` — preload bridge (`window.openWhisp`)
- `src/renderer/` — React UI (`App.tsx`, overlay, audio recorder)
- `src/shared/` — pure logic shared by main and renderer (text tools, types); most unit tests target this
- `tests/` — `*.test.ts` run with `node --experimental-strip-types --test`
- `native/`, `swift/` — platform helpers for focus detection, paste and hotkeys
- `scripts/` — native build (`build-native.mjs`) and the electron-builder `afterPack` icon hook (`brand-windows.cjs`)
- `.github/workflows/` — `ci.yml` (Windows build and tests on every PR), `release.yml` (manual Windows release)

**Can't run or verify on Linux**
- Windows native helper compile (`csc.exe`), UI Automation focus detection, and the Ctrl+V paste helper
- Windows packaging (`--win`), NSIS installer, and the executable icon branding on a real `.exe` (tests cover the hook with synthetic executables)
- Running the app or UI, microphone capture, global hotkeys, the overlay window
- Ollama rewriting quality and the Windows Ollama auto-installer
- For Windows behavior, use the CI workflow on a PR and mark anything else **NOT VERIFIED**.

**Gotchas**
- Tests import `.ts` files directly through Node's type stripping, so test imports need the `.ts` extension.
- `win.signAndEditExecutable` is `false` on purpose (skips the winCodeSign download, which needs symlink privileges); the icon gets embedded by `scripts/brand-windows.cjs` instead. Don't re-enable it.
- `build/native/` and `release/` are build output and are gitignored.
- `src/renderer/App.tsx` and `styles.css` are written as very long lines; edit carefully and don't reformat them as part of an unrelated change.
- Shell for Windows scripts is cmd (`BUILD.cmd`); CI steps use PowerShell.

**Releases**
- GitHub → Actions → "Release (Windows)" → Run workflow → enter a version like `1.3.0`. It tests, builds, zips `release/win-unpacked` as `Undertone-v<version>-win-x64.zip`, creates tag `v<version>` and a Release with auto-generated notes. It fails if the tag already exists.
- The release version is stamped into the packaged app only (`-c.extraMetadata.version`); `package.json` in the repo isn't changed.
