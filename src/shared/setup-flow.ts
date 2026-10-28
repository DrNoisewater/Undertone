export interface SetupSteps {
  ensureEngine(): Promise<void>;
  hasModel(): Promise<boolean>;
  downloadModel(): Promise<void>;
  verify(): Promise<void>;
  enable(): Promise<void>;
}
export async function completeWritingSetup(steps: SetupSteps, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted(); await steps.ensureEngine(); signal.throwIfAborted();
  if (!(await steps.hasModel())) {signal.throwIfAborted();await steps.downloadModel();}
  signal.throwIfAborted();await steps.verify();signal.throwIfAborted();await steps.enable();
}
