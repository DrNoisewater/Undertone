# Recording readiness fix (0.3.4)

Run BUILD.cmd on Windows. Wait for the bottom box to say Speak now.
The box waits for a captured audio buffer; the first buffer is retained.
Microphone testing also waits for capture. Startup timeout and cancellation
release microphone resources. No always-on listening was added.

Validation: 21 tests, TypeScript checking and Electron production build passed
on Linux. Native Windows/macOS packaging and real microphones were not tested.

Test first recording after launch, after idle, Escape during startup, hold mode,
and microphone test. This is updated source, not a compiled installer.

The suggested additions are implemented in 0.4.0; see README.md.
