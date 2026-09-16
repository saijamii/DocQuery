import { extractText } from "unpdf";

export async function extractTextFromPdf(
    data: Uint8Array
) {
    const { text } = await extractText(data);

    return text.join("\n");
}