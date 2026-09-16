/**
 * Splits text into overlapping chunks, cutting at a paragraph or sentence
 * boundary when one sits near the end of the window instead of mid-sentence.
 */
export function splitIntoChunks(
    text: string,
    chunkSize = 1000,
    overlap = 200
) {
    const chunks: string[] = [];

    let start = 0;

    while (start < text.length) {
        const hardEnd = Math.min(start + chunkSize, text.length);

        // Only look for a break in the last quarter of the window, so chunks
        // stay close to chunkSize
        const searchFrom = start + Math.floor(chunkSize * 0.75);
        const end =
            hardEnd < text.length
                ? findBreak(text, searchFrom, hardEnd)
                : hardEnd;

        const chunk = text.slice(start, end).trim();

        if (chunk) {
            chunks.push(chunk);
        }

        const next = end - overlap;

        // Always move forward, whatever the boundary search returned
        start = next > start ? next : end;
    }

    return chunks;
}

/** Last paragraph, sentence or line break in [from, to), else `to`. */
function findBreak(text: string, from: number, to: number) {
    const window = text.slice(from, to);

    for (const marker of ["\n\n", ". ", ".\n", "\n", " "]) {
        const index = window.lastIndexOf(marker);
        if (index !== -1) {
            return from + index + marker.length;
        }
    }

    return to;
}
