export interface CleanupPassResult {
  clean: boolean;
  removals: number;
}

export interface CleanupReconciliationResult {
  observations: number;
  removals: number;
}

export interface CleanupReconciliationOptions {
  quietPeriodMs: number;
  timeoutMs: number;
  pollIntervalMs: number;
  now?: () => number;
  wait?: (milliseconds: number) => Promise<void>;
}

export async function waitForCleanupQuiescence(
  observeAndClean: () => Promise<CleanupPassResult>,
  options: CleanupReconciliationOptions
): Promise<CleanupReconciliationResult> {
  const now = options.now ?? Date.now;
  const wait = options.wait ?? delay;
  const startedAt = now();
  let quietSince: number | null = null;
  let observations = 0;
  let removals = 0;

  while (now() - startedAt < options.timeoutMs) {
    const pass = await observeAndClean();
    observations += 1;
    removals += pass.removals;
    const observedAt = now();
    if (!pass.clean) {
      quietSince = null;
    } else if (pass.removals > 0 || quietSince === null) {
      quietSince = observedAt;
    } else if (observedAt - quietSince >= options.quietPeriodMs) {
      return { observations, removals };
    }
    await wait(options.pollIntervalMs);
  }
  throw new Error(
    `Cleanup reconciliation не достиг clean quiescence ${options.quietPeriodMs} ms за ${options.timeoutMs} ms.`
  );
}

async function delay(milliseconds: number): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}
