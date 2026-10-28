# Undertone 0.4.11 — Windows executable and shortcut icon

The package now embeds the copper Undertone logo into the executable using the bundled JavaScript resource editor, without downloading winCodeSign or requiring symlink privileges. The Windows window icon is set explicitly. The generated PNG/ICO use the same mark as the in-app logo. All earlier overlay and dictation changes are included.

Run the full BUILD.cmd, then install the newly generated installer. Existing installed executables and shortcuts do not change just by extracting this ZIP. Windows may temporarily cache an old shortcut icon.

Validated: 70 tests, TypeScript, production app build, executable icon round-trip and packaging hook under paths containing spaces. Full Windows installer execution is not tested here.

# Undertone 0.4.10 — animated processing overlay

- Copper/violet glow, moving light, and animated bars during polishing; distinct transcription and completion treatment. Respects reduced-motion preferences.
- Overlay stays on the monitor selected by the pointer at microphone startup; repositions safely if a monitor disappears.
- Reasserts non-focusing topmost visibility during active work and retries transient show failures. Window creation is deduplicated.
- Done starts a 300ms fade immediately; no completion hold or late reopening. Errors remain briefly visible; microphone startup remains hidden until capture is ready.
- Validation: 68 regression tests, TypeScript, production app build. Windows display/fullscreen behavior and native packaging require on-device verification.

Extract and run the full BUILD.cmd.

# Undertone 0.4.9 — natural punctuation commands

Spoken formatting accepts insert/add/type plus an optional "a" before comma, period/full stop, question mark, exclamation mark/point, colon, and semicolon. Line breaks accept new line/next line/line break; paragraphs accept new paragraph/next paragraph/paragraph break.

Settings → Speak naturally → Use short punctuation commands enables bare punctuation names. Off by default because ordinary mentions also become punctuation. Prefix any command with "literal" to keep its words. The expandable "What can I say?" guide lists all alternatives. Works in Verbatim. Turning off Spoken formatting disables all commands.

Extract this source and run the full BUILD.cmd. Windows runtime still needs on-device verification.

# Undertone 0.4.8

- Cleanup choices show measured, per-mode short-dictation timing ranges for this session. No guessed hardware-independent times; model load time is excluded and explained.
- All cleanup levels explicitly restore punctuation, including grammatical comma placement. Clean preserves wording.
- Disable optional thinking for models advertising that capability; retain existing 10-minute model keep-alive.
- Windows installer and actual model output still require Windows testing. Run the full BUILD.cmd for this source update.

## 0.4.7 — Optional automatic writing setup (Windows)

Studio and Settings now offer Enable writing improvements. Select Clean,
Refine, or Polish, then enable. Undertone checks for the existing engine/model,
downloads the official Ollama Windows installer if needed, verifies its Windows
Authenticode signature, installs it, starts it, downloads the recommended local
model, and selects the requested writing mode. Progress and a Stop setup button
are shown. An active installer is allowed to finish before cancellation takes
effect. Failed/cancelled setup does not enable rewriting; installed components
are kept for retry. Downloads require internet and several GB of free space.
Windows may request installation permission. No command-line steps are needed.

Existing models are reused. Once installed, all cleanup levels are available
without further downloads. Verbatim turns rewriting off. Nothing is installed
until the user chooses Enable writing improvements. The actual installer starts
only from that explicit setup action. The endpoint/model restrictions remain local.

On macOS, Ollama installation remains guided via Get Ollama; automatic model
setup works once the engine is installed. Windows is the automatic installer target.

Broader paste compatibility from 0.4.6, overlay fade, approved ready sound and
Windows packaging fixes remain included. Rebuild both app and native helper with
BUILD.cmd (or -fast with existing dependencies), not -package.

59 regression tests, TypeScript checking and production builds pass on Linux.
The real Windows installer, native helper compilation, Windows paste delivery,
and visual UI interactions remain unverified here. Setup tests use simulated
steps; they do not install software. Signing-tool workaround still retains the
known default Electron EXE icon/metadata limitation.

Installer source: https://ollama.com/download/OllamaSetup.exe
Ollama official silent-install reference: https://github.com/ollama/ollama/blob/main/scripts/install.ps1

## 0.4.6 — Broader Windows paste compatibility

Recognizes focused descendants of rich editors, custom text-pattern editors,
and custom text controls that expose a native caret. A re-created editor can
match its previous parent/control/position signature instead of requiring an
unchanged runtime ID. Empty identifiers never qualify. No field text is read
for identification. Password/disabled/known read-only fields and focused
buttons/links remain excluded. A changed window or distinct field still blocks
paste. The helper rechecks the destination immediately before sending Ctrl+V.

Each failure now supplies a reason (unrecognized field, changed destination,
held modifiers, inaccessible editor, helper failure, or blocked keyboard input).
Text stays on the clipboard with manual-paste instructions. A successful input
request says Paste sent, because accepting the key events does not prove the
editor inserted the text. No blind retry is performed that could duplicate text.
Existing macOS behavior is retained with Command+V instructions.

Build the complete source with BUILD.cmd, or BUILD.cmd -fast if dependencies
are already installed. Do not use -package for this upgrade: the native helper
and app both changed and must be rebuilt. Quit the old tray app before opening
the updated app.

54 tests and TypeScript/production app compilation pass on Linux. Windows UIA,
native helper compilation and physical paste delivery cannot be tested here.
ChatGPT Windows/browser, Notepad, browser editors and elevated apps need manual
validation. This broadens detection; it does not promise universal compatibility.
If pasting fails, the main app now shows the specific failure category.

The Electron default EXE/taskbar logo remains a known tradeoff of the 0.4.5
packaging workaround. The copper microphone/U is Undertone's intended mark.

## 0.4.5 — Automatic overlay fade and packaging fix

The overlay stays hidden at launch, while idle, and during microphone startup.
It appears when capture is ready, stays visible during recording and processing,
and fades over 200 ms after a 1.2-second completion indication. Errors remain
visible for 3.5 seconds before fading; details and retry remain in the main app.
Cancellation fades out immediately. New activity cancels old fade timers.
The keep-visible setting is removed; its old saved value is ignored.

Windows packaging skips electron-builder's executable signing/resource-editing
stage, avoiding extraction of the legacy winCodeSign archive with macOS symlinks.
This builds an unsigned app. The app EXE may retain Electron's default icon and
file metadata; installer/uninstaller icons are configured separately, and the
in-app and tray branding remain. No admin privileges or cache deletion are
required by this workaround.

Build: extract and run BUILD.cmd. With dependencies already installed, use
BUILD.cmd -fast. BUILD.cmd -package retries only packaging when compiled files
and the native helper already exist; do not use it to apply source-code changes.

49 automated tests pass, including overlay lifetimes/races and an upstream
packager check that the failing executable-editing path is skipped. TypeScript
and production app builds pass. Windows native compilation, visual fading and
final installer creation have not been run in this Linux environment.

## 0.4.3 — Portable native-build regression tests

Fixes a test that incorrectly expected UIAutomationClient.dll to be missing on
Windows computers where it is installed. Native build tests now simulate file
availability and compiler execution instead of depending on the host computer.
Coverage includes all prerequisites missing, framework present/source absent,
all prerequisites present, and compiler failure. The real build still checks
actual files and invokes the installed compiler. Tests are not bypassed.

43 tests, TypeScript checking and production app build passed on Linux.
Real Windows helper compilation and installer packaging remain unverified here.

Extract the complete ZIP and run BUILD.cmd.
To avoid reinstalling dependencies in your existing 0.4.2 folder, copy these two
files from this archive over their counterparts, then run BUILD.cmd -fast:
- scripts/build-native.mjs
- tests/native-build.test.ts
That minimal patch retains the old displayed version but includes this fix.

## 0.4.2 — Windows helper source path fix

The native build now resolves its source and output from the build script's
own directory and uses absolute Windows paths with native separators. It passes
arguments directly without a shell, so spaces in usernames and project folders
are preserved. It checks the source, compiler and WPF references before compiling.

Extract the complete archive and run BUILD.cmd.
To reuse an already installed dependency folder, replace scripts/build-native.mjs
in your previous project with this version and run BUILD.cmd -fast there.

Validation: 40 regression tests, TypeScript checking and production app build
passed on Linux. Includes Windows path tests with Dr. Noisewater in the path.
The Windows .NET compiler and final installer could not be run on Linux.
Dependency deprecation and install-script notices in the supplied log were
warnings; the reported stopping error was CS1504 during native compilation.

## 0.4.1 — Selected ready sound

The ready cue now plays the exact approved first-note WAV, embedded locally.
It retains the soft attack and fade-out, with no second note or upward sweep.
Enable Ready sound in Settings. Existing sound preferences are preserved.
The standalone sample is included at assets/ready-sound.wav.

# Undertone 0.4.0 — Everyday dictation additions

Extract this complete source ZIP and run BUILD.cmd on Windows. Use
BUILD-MAC.command on macOS. Existing settings are retained; new settings get
safe defaults. No dependency upgrades are required by these changes.

## New controls in Settings

- **Ready sound:** optional quiet chime, off by default. Plays only after the
  microphone starts delivering audio. Headphones avoid speaker sound leaking
  into the microphone. Cancellation closes the audio context and stops sound.
- **Spoken formatting:** on by default. Say **new paragraph** or **new line**.
  Punctuation commands: **insert comma**, **insert period**, **insert question
  mark**, **insert exclamation mark**, **insert colon**, **insert semicolon**.
  Say **literal new paragraph** to type the command phrase itself. Turn the
  option off to keep all phrases as spoken. Commands apply after transcription,
  including in Verbatim mode; accuracy depends on speech recognition.
- **Your words, spelled your way:** add a phrase and its preferred replacement,
  then click **Save replacements**. Example: noise water labs → Noisewater Labs.
  Up to 100 rules; case-insensitive whole-phrase matching; longer phrases win;
  replacements do not cascade or match across paragraph breaks. Rules run
  after optional polishing, so your spelling wins. Remove a row and save to
  delete a rule. No rules are silently preloaded.
- **Recording timer:** visible in the overlay and Studio while listening. Starts
  only at readiness, warns at 4:30, and automatically finishes at 5:00. A new
  recording starts a fresh timer. The warning is visual.

Line/paragraph breaks are preserved. If an optional rewrite flattens them,
Undertone falls back to your formatted original with replacements applied.
Your original transcription remains available separately.

## Validation for this release

36 automated regression tests passed. TypeScript checking and Electron
main/preload/renderer production build passed on Linux. Clock rendering checked
at 4:29, 4:30, and 5:00. Full browser interaction checks were unavailable because
the Chromium download failed. Native Windows/macOS packaging, physical audio,
and real target-app pasting still need device testing. This ZIP contains source,
not a compiled Windows installer.

## Quick on-device check

1. Enable Ready sound, press the shortcut, and wait for Speak now/the chime.
2. Dictate: Hello insert comma world new paragraph This is the next paragraph.
3. Save a replacement, dictate that phrase in Verbatim, and check the result.
4. Keep a recording going to 4:30, check the warning, and verify it stops at 5:00.
5. Check Escape during startup, a quick hold/release, and a normal new recording.

---

# Undertone — Noisewater Labs

Windows-first, local dictation based on OpenWhisp. **Undertone is a working name.**

## Status: 0.3.0 source preview

The redesigned application builds successfully and its pure logic tests pass. The UI was rendered in Electron and checked on the simplified pages at 1180px and 800px widths using a mocked desktop bridge. This package is **source, not a tested Windows executable or a finished production release**. Native microphone capture, global shortcuts, automatic paste, model inference and installers still require real Windows/macOS validation. No signing certificates are included.

## Windows: build and run

1. Extract this entire folder to a normal writable location (not inside the ZIP).
2. Install Node.js 22.12 or later if it is not already installed. npm comes with Node.
3. Double-click `BUILD.cmd`. It reports missing prerequisites together and keeps the window open on errors. No Visual Studio installation is required by the Windows helper: it uses the .NET Framework compiler included with standard Windows 10/11 installations. If that compiler is absent, enable/install .NET Framework 4.8.
4. The build downloads npm/Electron dependencies, checks TypeScript, runs regression tests, compiles the Windows helper and creates an NSIS installer in `release`.
5. Install and open Undertone. Click Get ready in Setup to download the speech files and check keyboard access. Run the four-second microphone test and play it back. Then click Start using Undertone. Test dictation in Notepad first.
6. Click inside Notepad, press **F9**, speak, then press **F9** again. For a conflict with another program, choose F8, Ctrl+Alt+Space, or Ctrl+Shift+Space in Preferences. Escape cancels while recording. Hold-to-talk remains optional.

For subsequent builds with unchanged dependencies: `BUILD.cmd -fast`. Use a full build after dependency changes. The installer is unsigned; reputation warnings are possible.

Verbatim mode is the default and uses no rewrite model. For Clean/Refine/Polish, install Ollama via the Models page, then download a local text model. The upstream recommendation remains `gemma4:e4b`; smaller locally installed models can be selected. Model quality, disk use and processing time depend on your hardware. Whisper currently uses CPU inference for broad hardware compatibility; GPU acceleration is not implemented in this version.

## macOS — retained, not yet tested here

Build on the target Mac. Install Node.js and Xcode command line tools (`xcode-select --install`), then run `chmod +x BUILD-MAC.command` and `./BUILD-MAC.command` from Terminal. The script builds the Swift helper and produces DMG/ZIP output for the host architecture. Grant microphone, Accessibility and Input Monitoring permissions. The Mac shortcut is Fn with hold or toggle modes. Signed/notarized distribution and separate Intel/Apple Silicon builds are later release tasks. We can walk through this setup when you are ready.

## Included

- Simplified graphite/copper Studio, History and Settings navigation. Optional downloads and writing styles are behind Advanced settings.
- Windows global shortcut listener and focus-aware paste helper; original Swift helper retained for macOS.
- F9 toggle default on Windows; optional hold mode and shortcut presets. Escape discards an active recording. Five-minute recording limit.
- Live four-second microphone test, sample playback and input selection. Native macOS still uses Fn.
- Small recording overlay with microphone levels; idle overlay preference.
- Whisper transcription, optional local Ollama rewriting, vocabulary hints for rewriting.
- Raw transcription fallback when rewriting fails; persistent in-session last text with a Copy button.
- Retry failed audio without speaking again, or discard it. Failed audio stays only in memory for up to ten minutes; retry deliberately copies instead of auto-pasting into an old target.
- Optional local history (off by default), capped at 100 entries, with copy and clear controls.
- Tray operation, optional start at login, single-instance protection.
- Per-user settings and model storage, atomic settings writes, microphone release after recording.
- WAV size/format validation, speech download progress, helper/request timeouts.

## Privacy and insertion behavior

No accounts, API keys, telemetry, remote fonts or cloud speech services are used. Network access is required to install software and download models. Dictation opens only a loopback Ollama endpoint; cloud-named/remote-tagged models and unverifiable model metadata are rejected before text is sent. This assumes a genuine, uncompromised local Ollama server. Downloads are never supplied with recordings or transcripts. Whisper dictation uses cached models with `local_files_only` enabled.

Audio is held in memory while recording/processing; failed recordings can remain for up to ten minutes for Retry. Discard clears that temporary copy immediately. Audio is not written to an audio history. The microphone test also offers a temporary in-memory playback sample. History saves text only if opted in. Turning history off preserves old entries until explicitly cleared. History is not encrypted; it uses your operating-system user account protections.

Text is placed on the system clipboard (which may be visible to OS clipboard history or third-party clipboard tools). Automatic paste verifies the original foreground process and focused control; unsupported, secure/password or changed controls fall back to clipboard copy. Windows uses UI Automation, which does not expose every custom textbox. Elevated apps and some games may reject simulated input. The app does not automatically press Enter or submit messages. The previous clipboard is intentionally replaced; automatic clipboard restoration is not implemented.

## Before calling this a release

See `VALIDATION.md` for the real-machine test checklist and current limitations. Do not present passing TypeScript/UI tests as evidence that native dictation has been tested end to end.

## Upgrading from 0.2.0

Existing shortcut preferences are preserved. In Settings, click **Use F9 · press to start / stop** to switch to the simpler defaults. The working app name remains Undertone.

## Development

```sh
npm ci
npm run build:native
npm run dev
npm run typecheck
npm test
npm run build
```

Build each native installer on its corresponding OS. `src/main` owns local processing and settings, `src/renderer` owns the interface and microphone capture, `native/UndertoneHelper.cs` handles Windows integration, and `swift/OpenWhispHelper.swift` handles macOS integration.

## Attribution

Based on [giusmarci/openwhisp](https://github.com/giusmarci/openwhisp), commit `b6be778334e68297b7a39a1b35508d09f567afb9`. Original project by giusmarci / Raelume; its README declares MIT licensing. The original README is preserved as `UPSTREAM-README.md`. New design and Windows adaptation: Noisewater Labs. Model and dependency licenses remain their respective authors' terms.
