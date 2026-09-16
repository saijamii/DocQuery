import { Fragment, type ReactNode } from "react";

/**
 * Renders the constrained Markdown subset the answer generator is asked for:
 * short paragraphs, "###" headings, bold labels (Purpose / Usage / Notes),
 * and bullet or numbered lists. Anything else is shown as plain text rather
 * than as raw Markdown characters.
 */

type Block =
    | { kind: "heading"; text: string }
    | { kind: "label"; text: string }
    | { kind: "paragraph"; text: string }
    | { kind: "bullets"; items: string[] }
    | { kind: "numbered"; items: string[] };

const FILLER_OPENING =
    /^(?:certainly|sure|of course|absolutely|no problem|great question|here(?:'s| is| are)|i'd be happy to[^.!?\n]*|i can help[^.!?\n]*)[^.!?\n]*[.!:]\s+/i;

/** Drops preamble the model may add despite the instructions. */
function stripFiller(text: string) {
    let out = text.trimStart();

    // At most two: "Certainly! Here is what the document says: ..."
    for (let i = 0; i < 2; i++) {
        const next = out.replace(FILLER_OPENING, "");
        if (next === out) break;
        out = next.trimStart();
    }

    return out;
}

function parseBlocks(markdown: string): Block[] {
    const blocks: Block[] = [];
    const lines = stripFiller(markdown.replace(/\r\n?/g, "\n")).split("\n");

    let paragraph: string[] = [];
    let bullets: string[] = [];
    let numbered: string[] = [];

    function flush() {
        if (paragraph.length > 0) {
            blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
            paragraph = [];
        }
        if (bullets.length > 0) {
            blocks.push({ kind: "bullets", items: bullets });
            bullets = [];
        }
        if (numbered.length > 0) {
            blocks.push({ kind: "numbered", items: numbered });
            numbered = [];
        }
    }

    for (const rawLine of lines) {
        const line = rawLine.trim();

        if (line === "" || /^([-*_])\1{2,}$/.test(line)) {
            flush();
            continue;
        }

        const heading = line.match(/^#{1,6}\s+(.*)$/);
        if (heading) {
            flush();
            blocks.push({ kind: "heading", text: heading[1].trim() });
            continue;
        }

        // A line that is nothing but bold text acts as a label
        const label = line.match(/^\*\*([^*]+)\*\*:?$/);
        if (label) {
            flush();
            blocks.push({ kind: "label", text: label[1].trim() });
            continue;
        }

        const bullet = line.match(/^[-*•]\s+(.*)$/);
        if (bullet) {
            if (paragraph.length > 0 || numbered.length > 0) flush();
            bullets.push(bullet[1].trim());
            continue;
        }

        const numberedItem = line.match(/^\d+[.)]\s+(.*)$/);
        if (numberedItem) {
            if (paragraph.length > 0 || bullets.length > 0) flush();
            numbered.push(numberedItem[1].trim());
            continue;
        }

        if (bullets.length > 0 || numbered.length > 0) flush();
        paragraph.push(line);
    }

    flush();

    return blocks;
}

/** Bold, italic and inline code; leftover markers are stripped, not shown. */
function renderInline(text: string): ReactNode {
    const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|(?<!\*)\*[^*]+\*)/g);

    return parts.filter(Boolean).map((part, index) => {
        if (/^\*\*[^*]+\*\*$/.test(part)) {
            return (
                <strong key={index} className="font-semibold text-white">
                    {part.slice(2, -2)}
                </strong>
            );
        }

        if (/^`[^`]+`$/.test(part)) {
            return (
                <code
                    key={index}
                    className="rounded-[4px] border border-line bg-elevated px-1 py-0.5 font-mono text-[12px]"
                >
                    {part.slice(1, -1)}
                </code>
            );
        }

        if (/^\*[^*]+\*$/.test(part)) {
            return (
                <em key={index} className="italic">
                    {part.slice(1, -1)}
                </em>
            );
        }

        return (
            <Fragment key={index}>{part.replace(/\*\*|`|^#+\s*/g, "")}</Fragment>
        );
    });
}

export function AnswerMarkdown({ markdown }: { markdown: string }) {
    const blocks = parseBlocks(markdown);

    return (
        <div className="max-w-[68ch] text-[14px] text-ink">
            {blocks.map((block, index) => {
                const first = index === 0;

                switch (block.kind) {
                    case "heading":
                        return (
                            <h3
                                key={index}
                                className={`border-b border-line pb-1.5 text-[15px] font-semibold leading-snug text-white ${
                                    first ? "" : "mt-7"
                                }`}
                            >
                                {renderInline(block.text)}
                            </h3>
                        );

                    case "label":
                        return (
                            <p
                                key={index}
                                className={`text-[11px] font-semibold uppercase tracking-[1px] text-accent ${
                                    first ? "" : "mt-5"
                                }`}
                            >
                                {renderInline(block.text)}
                            </p>
                        );

                    case "paragraph":
                        return (
                            <p
                                key={index}
                                className={`leading-[1.7] ${
                                    first ? "" : "mt-2.5"
                                }`}
                            >
                                {renderInline(block.text)}
                            </p>
                        );

                    case "bullets":
                        return (
                            <ul
                                key={index}
                                className={`list-disc space-y-1.5 pl-5 leading-[1.7] marker:text-muted ${
                                    first ? "" : "mt-2.5"
                                }`}
                            >
                                {block.items.map((item, itemIndex) => (
                                    <li key={itemIndex} className="pl-0.5">
                                        {renderInline(item)}
                                    </li>
                                ))}
                            </ul>
                        );

                    case "numbered":
                        return (
                            <ol
                                key={index}
                                className={`list-decimal space-y-1.5 pl-5 leading-[1.7] marker:text-muted ${
                                    first ? "" : "mt-2.5"
                                }`}
                            >
                                {block.items.map((item, itemIndex) => (
                                    <li key={itemIndex} className="pl-0.5">
                                        {renderInline(item)}
                                    </li>
                                ))}
                            </ol>
                        );
                }
            })}
        </div>
    );
}
