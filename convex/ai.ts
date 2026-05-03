"use node";

import { runs, tasks } from "@trigger.dev/sdk/v3";
import { action } from "./_generated/server";
import type { describeRandomMood } from "../trigger/describeRandomMood";

export const describeRandomMoodAction = action({
    args: {},
    handler: async () => {
        const handle = await tasks.trigger<typeof describeRandomMood>(
            "describe-random-mood",
            undefined,
        );
        const result = await runs.poll<typeof describeRandomMood>(handle.id);

        if (!result.isSuccess || !result.output) {
            throw new Error(result.error?.message ?? "Trigger.dev mood task failed.");
        }

        return result.output.text;
    },
});
