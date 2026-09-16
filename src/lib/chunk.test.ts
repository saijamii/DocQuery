// Run: node --test src/lib/chunk.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { splitIntoChunks } from "./chunk.ts";

test("covers the whole text and always moves forward", () => {
    const text = Array.from(
        { length: 60 },
        (_, i) => `Sentence number ${i} about the washer dispenser. `
    ).join("");

    const chunks = splitIntoChunks(text, 200, 40);

    assert.ok(chunks.length > 1);
    assert.ok(chunks.every((c) => c.length <= 200));
    assert.ok(text.includes(chunks[0]));
    assert.ok(text.trim().endsWith(chunks.at(-1)!.trim()));
});

test("prefers a sentence boundary over a mid-word cut", () => {
    const text = `${"a".repeat(80)}. ${"b".repeat(200)}`;

    const [first] = splitIntoChunks(text, 100, 20);

    assert.ok(first.endsWith("."));
});

test("no text means no chunks", () => {
    assert.deepEqual(splitIntoChunks("   "), []);
});
