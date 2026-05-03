"use node";

import { tasks } from "@trigger.dev/sdk/v3";
import { action } from "./_generated/server";
import type { describeRandomMood } from "../trigger/describeRandomMood";

export const describeRandomMoodAction = action({
  args: {},
  handler: async () => {
    const result = await tasks.triggerAndWait<typeof describeRandomMood>(
      "describe-random-mood",
      undefined,
    );

    if (!result.ok) {
      const message =
        result.error instanceof Error
          ? result.error.message
          : "Trigger.dev mood task failed.";
      throw new Error(message);
    }

    return result.output.text;
  },
});
