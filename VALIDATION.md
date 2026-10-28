# Validation and release gate

## Completed in this environment
- Dependency installation with the upstream lockfile; lockfile updated for new application metadata and build dependency classification.
- TypeScript check and Vite/Electron production bundle build.
- Seventeen automated tests, including recording-session races, Escape cancellation, retry expiry and the original audio/policy checks: loopback acceptance; remote/credential URL rejection; cloud model name rejection; PCM samples; malformed/truncated input; wrong sample rate/channels; odd-length sample data.
- Electron offscreen UI inspection of Studio, History, Settings and Setup at 1180 x 850 and 800 x 600. No horizontal overflow in tested screens. Checks also cover three-choice navigation, advanced settings collapsed by default, setup microphone gating, retry/copy and retention of last text after failure. Desktop services were mocked for these UI checks.

## Not verified here
- Windows C# helper compilation and its UI Automation / SendInput behavior.
- macOS Swift compilation, permissions, Fn behavior and focus tokens.
- Real microphone recording, model download completion, offline Whisper inference and local Ollama rewrite quality/performance.
- Windows NSIS and macOS DMG installation; signing, notarization, Windows reputation.

## First Windows acceptance run
1. Run BUILD.cmd and install. Launch twice: only one instance should remain.
2. Finish Setup. Check the selected microphone; download Whisper and test Verbatim in Notepad.
3. Test F9 toggle, rapid double press during microphone startup, Escape during startup/recording, hold mode and each shortcut preset. Stop recording and verify Windows microphone indicator turns off.
4. Dictate in Notepad, a browser textarea and a rich-text editor. Check punctuation, accented characters, Unicode and multiline output.
5. Change window or textbox during processing: text should copy instead of paste. A password field must not accept auto-paste.
6. Test ordinary and elevated editors; elevated/custom controls may need manual paste.
7. Unplug the microphone, turn microphone access off and try a too-short recording: errors should be visible and subsequent valid recording should recover.
8. Install a local Ollama model. Test Clean/Refine/Polish, then stop Ollama during a request: raw transcription must be recoverable.
9. Disconnect the network after model setup. Verbatim and already-installed local rewriting must still work.
10. Confirm history is initially off. Enable, record, restart, copy, clear, disable. Confirm no audio files were saved.
11. Test tray closing, Quit, launch-at-login, high DPI, multiple monitors and model folder changes.
12. Repeat the applicable checks on macOS before distributing a Mac build.

## Remaining product work
Real-machine fixes have priority. Then add more rigorous voice-activity handling, optional speech model selection/GPU support, richer vocabulary correction, accessibility review and signed installers. Cancellation currently discards active recordings; it does not interrupt a transcription already processing. Current recording uses the upstream ScriptProcessor audio path; migration to AudioWorklet remains future work. Failed audio is retained in memory for retry for up to ten minutes, while last completed text survives later failures in the same session. This source preview does not claim full Wispr Flow parity.

## 0.3.0 additional real-device checks
- Microphone test: verify live meter and playback, permission denial, quiet input, device unplug, leaving Settings mid-test.
- Failed transcription: retry within ten minutes copies the recovered text; discard removes it; expired retry asks for a new recording.
- Escape while opening the microphone must leave no capture stream alive. Escape during recording must not paste or save the cancelled words.
- Old 0.2.0 shortcut preferences are preserved; the recommended F9 button updates them explicitly.
