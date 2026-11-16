/** Passed by the Windows sign-in entry so Undertone starts in the tray without a window. */
export const HIDDEN_LAUNCH_ARG = '--hidden';

export function isHiddenLaunch(argv: readonly string[]): boolean {
  return argv.includes(HIDDEN_LAUNCH_ARG);
}
