"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

declare const process: {
  env: {
    OPENAI_API_KEY?: string;
    OPENAI_MODEL?: string;
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

type OpenAITextContent = {
  type?: string;
  text?: string;
};

type OpenAIOutputItem = {
  content?: OpenAITextContent[];
};

type OpenAIResponse = {
  output_text?: string;
  output?: OpenAIOutputItem[];
};

type PracticePrompt = {
  englishSentence: string;
  wordHints: Array<{
    english: string;
    spanish: string;
  }>;
};

type PracticeGrade = {
  passed: boolean;
  weaknesses: Array<{
    weakness: string;
    severity: number;
  }>;
  feedback: string;
};

export const generatePracticePrompt = action({
  args: {
    level: v.number(),
    subjects: v.array(subjectValidator),
    weaknesses: v.array(weaknessValidator),
  },
  handler: async (_, args): Promise<PracticePrompt> => {
    const text = await completeJson(
      [
        "You create short translation drills for English speakers learning Spanish.",
        "Return only JSON with this exact shape:",
        '{"englishSentence":"string","wordHints":[{"english":"string","spanish":"string"}]}',
        "The English sentence must be short, natural, and exercise the selected Spanish grammar subjects.",
        "The wordHints list must include a literal Spanish translation for every meaningful present English word.",
      ].join("\n"),
      {
        learnerLevel: args.level,
        selectedSubjects: args.subjects,
        knownWeaknesses: args.weaknesses,
      },
    );

    const parsed = JSON.parse(text) as PracticePrompt;

    if (!parsed.englishSentence || !Array.isArray(parsed.wordHints)) {
      throw new Error("AI returned an invalid practice prompt.");
    }

    return {
      englishSentence: parsed.englishSentence,
      wordHints: parsed.wordHints
        .filter((hint) => hint.english?.trim() && hint.spanish?.trim())
        .map((hint) => ({
          english: hint.english.trim(),
          spanish: hint.spanish.trim(),
        })),
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
    const text = await completeJson(
      [
        "You grade Spanish translations from English speakers.",
        "Return only JSON with this exact shape:",
        '{"passed":true,"weaknesses":[{"weakness":"string","severity":1}],"feedback":"string"}',
        "Pass if the answer accurately translates the sentence and handles the selected grammar subjects.",
        "If it fails, list concise weakness names with severity from 1 to 10.",
        "Use an empty weaknesses array when there are no meaningful weaknesses.",
      ].join("\n"),
      {
        englishSentence: args.englishSentence,
        spanishAnswer: args.spanishAnswer,
        selectedSubjects: args.subjects,
      },
    );

    const parsed = JSON.parse(text) as PracticeGrade;

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

async function completeJson(systemPrompt: string, payload: unknown) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for Spanish practice.");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: JSON.stringify(payload),
        },
      ],
      text: {
        format: {
          type: "json_object",
        },
      },
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    console.error("OpenAI Spanish practice request failed", {
      status: response.status,
      details,
    });
    throw new Error("OpenAI Spanish practice request failed.");
  }

  const data = (await response.json()) as OpenAIResponse;
  const text = extractText(data);

  if (!text) {
    throw new Error("OpenAI returned an empty Spanish practice response.");
  }

  return text;
}

function extractText(data: OpenAIResponse) {
  if (data.output_text) {
    return data.output_text.trim();
  }

  return (
    data.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text)
      .find((text): text is string => Boolean(text?.trim()))
      ?.trim() ?? ""
  );
}
