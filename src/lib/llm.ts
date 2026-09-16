import { InferenceClient } from "@huggingface/inference";

const hf = new InferenceClient(process.env.HF_TOKEN);

/** Returned verbatim when the retrieved context does not support an answer. */
export const NO_ANSWER =
    "I couldn't find the answer in the selected documents.";

const SYSTEM_PROMPT = `
You answer questions about a set of project documents, using ONLY the
retrieved context supplied with the question.

If the context does not support an answer, reply with exactly this line and
nothing else:
${NO_ANSWER}

Never invent information and never use knowledge outside the context.

Write the answer as concise Markdown, following this format:

- Start directly with the answer. Never open with "Certainly", "Sure",
  "Here is", "Of course", "I'd be happy to" or any other preamble, and never
  restate the question.
- Lead with one or two short sentences that answer the question.
- Use "### " headings for major topics when the answer covers more than one.
- Under a heading, use the bold labels **Purpose**, **Usage** and **Notes**
  where they fit, each followed by its content on the next line.
- Use "- " bullets for multiple related points; one point per bullet.
- Keep paragraphs to two or three sentences. Separate every block with a
  blank line.
- Use no other Markdown: no tables, no code fences, no links, no images, no
  horizontal rules, no headings deeper than "###".
- Do not cite chunk numbers or mention the context, the documents or
  yourself.
`.trim();

export async function generateAnswer(
    question: string,
    context: string
) {
    const userPrompt = `
Retrieved context:
${context}

Question:
${question}
`.trim();

    try {
        const response = await hf.chatCompletion({
            model: "Qwen/Qwen2.5-72B-Instruct",
            messages: [
                {
                    role: "system",
                    content: SYSTEM_PROMPT,
                },
                {
                    role: "user",
                    content: userPrompt,
                },
            ],
            max_tokens: 700,
        });

        return response.choices[0]?.message?.content ?? "";
    } catch (error) {
        const details =
            error instanceof Error
                ? ((error as { httpResponse?: { body?: unknown } })
                      .httpResponse?.body ?? error.message)
                : error;

        console.error(
            "HUGGING FACE ERROR DETAILS:",
            JSON.stringify(details, null, 2)
        );

        throw error;
    }
}
