import { logger, task } from "@trigger.dev/sdk/v3";

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

export const describeRandomMood = task({
  id: "describe-random-mood",
  maxDuration: 60,
  run: async () => {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is required to describe a mood.");
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
        input: "describe a random mood",
      }),
    });

    if (!response.ok) {
      const details = await response.text();
      logger.error("OpenAI mood request failed", {
        status: response.status,
        details,
      });
      throw new Error("OpenAI mood request failed.");
    }

    const data = (await response.json()) as OpenAIResponse;
    const text = extractText(data);

    if (!text) {
      logger.error("OpenAI returned an empty mood description", { data });
      throw new Error("OpenAI returned an empty mood description.");
    }

    return { text };
  },
});

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
