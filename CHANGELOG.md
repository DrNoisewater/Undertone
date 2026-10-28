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

## 0.4.0

- Optional ready chime after capture readiness.
- Spoken line breaks, paragraphs, explicit punctuation, and literal escapes.
- Personal replacement editor, validation, and deterministic post-rewrite rules.
- Elapsed recording display and final 30-second visual warning.
- Preserves explicit formatting if the optional rewrite model ignores it.
- Early release avoids a misleading ready cue; processing clears recording UI.
- Added text pipeline, startup timing, and five-minute stop regression coverage.

# 0.3.0 — everyday use

- F9 press-to-start/press-to-finish default on Windows, with a one-click switch for existing users.
- Escape cancels recording, including cancellation during microphone startup.
- Three main navigation choices; optional model/style controls tucked into Advanced.
- Two-step setup with a four-second microphone check, live meter and sample playback.
- Last completed text stays available across later failures, with clear copy feedback.
- Failed audio can be retried or discarded; it expires from memory after ten minutes. Retry uses clipboard-only delivery.
- Serialized recording lifecycle handles quick presses, delayed microphones and the duration limit.
- Preserved Windows/macOS source and build scripts. Native OS validation remains outstanding.
