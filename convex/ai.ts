"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

declare const process: {
  env: {
    TRIGGER_API_URL?: string;
    TRIGGER_SECRET_KEY?: string;
  };
};

const subjectValidator = v.object({
  subject: v.string(),
  importance: v.number(),
  difficulty: v.number(),
  roadblock: v.string(),
});

const weaknessValidator = v.object({
  weakness: v.string(),
  severity: v.number(),
});

type PracticePrompt = {
  englishSentence: string;
  wordHints: string[];
};

type PracticeGrade = {
  passed: boolean;
  weaknesses: Array<{
    weakness: string;
    severity: number;
  }>;
  feedback: string;
};

type TriggerRun = {
  id?: string;
  error?: string;
};

type TriggerRunStatus =
  | "PENDING_VERSION"
  | "DELAYED"
  | "QUEUED"
  | "EXECUTING"
  | "REATTEMPTING"
  | "FROZEN"
  | "COMPLETED"
  | "CANCELED"
  | "FAILED"
  | "CRASHED"
  | "INTERRUPTED"
  | "SYSTEM_FAILURE";

type TriggerRunResult = {
  status?: TriggerRunStatus;
  output?: unknown;
  error?: string;
  attempts?: Array<{
    status?: string;
    error?: {
      message?: string;
    };
  }>;
};

export const generatePracticePrompt = action({
  args: {
    level: v.number(),
    subjects: v.array(subjectValidator),
    weaknesses: v.array(weaknessValidator),
  },
  handler: async (_, args): Promise<PracticePrompt> => {
    const parsed = await runTriggerTask<PracticePrompt>("generate-practice-prompt", {
      learnerLevel: args.level,
      selectedSubjects: args.subjects,
      knownWeaknesses: args.weaknesses,
    });

    if (!isPracticePrompt(parsed)) {
      throw new Error("AI returned an invalid practice prompt.");
    }

    return {
      englishSentence: parsed.englishSentence,
      wordHints: shuffle(
        parsed.wordHints.filter((hint) => hint.trim()).map((hint) => hint.trim()),
      ),
    };
  },
});

export const gradeTranslation = action({
  args: {
    englishSentence: v.string(),
    spanishAnswer: v.string(),
    subjects: v.array(subjectValidator),
  },
  handler: async (_, args): Promise<PracticeGrade> => {
    const parsed = await runTriggerTask<PracticeGrade>("grade-translation", {
      englishSentence: args.englishSentence,
      spanishAnswer: args.spanishAnswer,
      selectedSubjects: args.subjects,
    });

    return {
      passed: Boolean(parsed.passed),
      weaknesses: Array.isArray(parsed.weaknesses)
        ? parsed.weaknesses
            .filter((weakness) => weakness.weakness?.trim())
            .map((weakness) => ({
              weakness: weakness.weakness.trim(),
              severity: Math.min(10, Math.max(1, Math.round(weakness.severity))),
            }))
        : [],
      feedback: parsed.feedback?.trim() || "Graded.",
    };
  },
});

async function runTriggerTask<T>(taskId: string, payload: unknown): Promise<T> {
  const apiUrl = process.env.TRIGGER_API_URL ?? "https://api.trigger.dev";
  const secretKey = process.env.TRIGGER_SECRET_KEY;

  if (!secretKey) {
    throw new Error("TRIGGER_SECRET_KEY is required for Spanish practice.");
  }

  const triggerResponse = await fetch(`${apiUrl}/api/v1/tasks/${taskId}/trigger`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      payload,
    }),
  });

  if (!triggerResponse.ok) {
    const details = await triggerResponse.text();
    console.error("Trigger.dev Spanish practice request failed", {
      status: triggerResponse.status,
      details,
    });
    throw new Error("Trigger.dev Spanish practice request failed.");
  }

  const triggerRun = (await triggerResponse.json()) as TriggerRun;

  if (!triggerRun.id) {
    throw new Error(triggerRun.error ?? "Trigger.dev did not return a run id.");
  }

  return await waitForTriggerRun<T>(apiUrl, secretKey, triggerRun.id);
}

async function waitForTriggerRun<T>(
  apiUrl: string,
  secretKey: string,
  runId: string,
): Promise<T> {
  const deadline = Date.now() + 60_000;

  while (Date.now() < deadline) {
    const response = await fetch(`${apiUrl}/api/v3/runs/${runId}`, {
      headers: {
        Authorization: `Bearer ${secretKey}`,
      },
    });

    if (!response.ok) {
      const details = await response.text();
      console.error("Trigger.dev Spanish practice run lookup failed", {
        status: response.status,
        details,
      });
      throw new Error("Trigger.dev Spanish practice run lookup failed.");
    }

    const run = (await response.json()) as TriggerRunResult;

    if (run.status === "COMPLETED") {
      return run.output as T;
    }

    if (isFailedRunStatus(run.status)) {
      const failedAttempt = run.attempts?.find((attempt) => attempt.error?.message);
      throw new Error(
        failedAttempt?.error?.message ??
          run.error ??
          "Trigger.dev Spanish practice run failed.",
      );
    }

    await sleep(1_000);
  }

  throw new Error("Trigger.dev Spanish practice run timed out.");
}

function isPracticePrompt(value: unknown): value is PracticePrompt {
  if (!value || typeof value !== "object") {
    return false;
  }

  const prompt = value as PracticePrompt;

  return (
    typeof prompt.englishSentence === "string" &&
    Array.isArray(prompt.wordHints) &&
    prompt.wordHints.every((hint) => typeof hint === "string")
  );
}

function isFailedRunStatus(status: TriggerRunStatus | undefined) {
  return (
    status === "CANCELED" ||
    status === "FAILED" ||
    status === "CRASHED" ||
    status === "INTERRUPTED" ||
    status === "SYSTEM_FAILURE"
  );
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function shuffle<T>(items: T[]) {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}
