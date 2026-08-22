import { describe, expect, it } from "vitest";
import { waitForCleanupQuiescence } from "../src/reconciliation.js";

describe("bounded cleanup reconciliation", () => {
  it("catches a resource that appears after an initially clean observation", async () => {
    let clock = 0;
    let pass = 0;
    const result = await waitForCleanupQuiescence(
      async () => {
        pass += 1;
        return {
          clean: true,
          removals: pass === 3 ? 1 : 0
        };
      },
      {
        quietPeriodMs: 1_000,
        timeoutMs: 5_000,
        pollIntervalMs: 250,
        now: () => clock,
        wait: async (milliseconds) => {
          clock += milliseconds;
        }
      }
    );

    expect(result.removals).toBe(1);
    expect(result.observations).toBeGreaterThan(3);
    expect(clock).toBeGreaterThanOrEqual(1_500);
  });

  it("fails closed when clean state never becomes stable", async () => {
    let clock = 0;
    await expect(
      waitForCleanupQuiescence(
        async () => ({ clean: false, removals: 0 }),
        {
          quietPeriodMs: 1_000,
          timeoutMs: 2_000,
          pollIntervalMs: 250,
          now: () => clock,
          wait: async (milliseconds) => {
            clock += milliseconds;
          }
        }
      )
    ).rejects.toThrow("не достиг clean quiescence");
  });
});
