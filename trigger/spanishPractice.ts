import { logger, task } from "@trigger.dev/sdk/v3";

const themes = [
    "Cars",
    "House",
    "Insects",
    "Food",
    "Family",
    "Weather",
    "Clothing",
    "Animals",
    "Sports",
    "School",
    "Work",
    "Travel",
    "Health",
    "Shopping",
    "Nature",
    "Colors",
    "Body",
    "Music",
    "Movies",
    "Books",
    "Kitchen",
    "Bathroom",
    "Bedroom",
    "Garden",
    "Beach",
    "Mountains",
    "City",
    "Airport",
    "Restaurant",
    "Hospital",
    "Farm",
    "Zoo",
    "Ocean",
    "Space",
    "Technology",
    "Hobbies",
    "Emotions",
    "Time",
    "Seasons",
    "Directions",
    "Money",
    "Furniture",
    "Tools",
    "Professions",
    "Fruits",
    "Vegetables",
    "Drinks",
    "Transportation",
    "Pets",
    "Holidays",
    "Flowers",
    "Trees",
    "Birds",
    "Fish",
    "Games",
];

function getRandomElement<T>(arr: T[]): T | undefined {
    return arr.length > 0
        ? arr[Math.floor(Math.random() * arr.length)]
        : undefined;
}

type Subject = {
    subject: string;
    importance: number;
    difficulty: number;
    roadblock: string;
};

type Weakness = {
    weakness: string;
    severity: number;
};

type GeneratePracticePromptPayload = {
    learnerLevel: number;
    selectedSubjects: Subject[];
    knownWeaknesses: Weakness[];
};

type GradeTranslationPayload = {
    englishSentence: string;
    spanishAnswer: string;
    selectedSubjects: Subject[];
};

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
    weaknesses: Weakness[];
    feedback: string;
};

export const generatePracticePrompt = task({
    id: "generate-practice-prompt",
    maxDuration: 60,
    run: async (
        payload: GeneratePracticePromptPayload,
    ): Promise<PracticePrompt> => {
        const text = await completeJson(
            [
                "You create short translation drills for English speakers learning Spanish.",
                "Return only JSON with this exact shape:",
                '{"englishSentence":"string","wordHints":[{"english":"string","spanish":"string"}]}',
                "The English sentence must be short, natural, and exercise the selected Spanish grammar subjects.",
                "The wordHints list must include a literal Spanish translation for every meaningful present English word.",
                `The sentence should be from the theme of ${getRandomElement(themes)}.`,
            ].join("\n"),
            payload,
        );

        const parsed = JSON.parse(text) as PracticePrompt;

        if (!parsed.englishSentence || !Array.isArray(parsed.wordHints)) {
            throw new Error("AI returned an invalid practice prompt.");
        }

        return parsed;
    },
});

export const gradeTranslation = task({
    id: "grade-translation",
    maxDuration: 60,
    run: async (payload: GradeTranslationPayload): Promise<PracticeGrade> => {
        const text = await completeJson(
            [
                "You grade Spanish translations from English speakers.",
                "Return only JSON with this exact shape:",
                '{"passed":true,"weaknesses":[{"weakness":"string","severity":1}],"feedback":"string"}',
                "Pass if the answer accurately translates the sentence and handles the selected grammar subjects.",
                "If it fails, list concise weakness names with severity from 1 to 10.",
                "Use an empty weaknesses array when there are no meaningful weaknesses.",
            ].join("\n"),
            payload,
        );

        return JSON.parse(text) as PracticeGrade;
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
        logger.error("OpenAI Spanish practice request failed", {
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
