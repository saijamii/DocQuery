import { NextRequest, NextResponse } from "next/server";

import { createEmbedding } from "@/lib/embeddings";
import { generateAnswer, NO_ANSWER } from "@/lib/llm";
import { supabase } from "@/lib/supabase";

const DEFAULT_MIN_SIMILARITY = Number(
    process.env.SIMILARITY_THRESHOLD ?? 0.3
);

export async function POST(request: NextRequest) {
    try {
        // 1. Get question from the user
        const body = await request.json();

        const question = body.question;
        const documentId = body.documentId;
        const projectId = body.projectId;

        // Threshold comes from the UI slider; env value is the fallback
        const minSimilarity =
            typeof body.threshold === "number" &&
            body.threshold >= 0 &&
            body.threshold <= 1
                ? body.threshold
                : DEFAULT_MIN_SIMILARITY;

        if (!question) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Question is required",
                },
                { status: 400 }
            );
        }

        // 2. Convert question into an embedding
        const queryEmbedding = await createEmbedding(question);

        // 3. Retrieve relevant chunks
        const { data: chunks, error: searchError } =
            await supabase.rpc("match_document_chunks", {
                query_embedding: queryEmbedding,
                match_count: 5,
                filter_document_id: documentId || null,
                filter_project_id: projectId || null,
            });

        if (searchError) {
            throw searchError;
        }

        // Nothing retrieved — there is no grounding, so do not call the model
        if (!chunks || chunks.length === 0) {
            return NextResponse.json({
                success: true,
                question,
                answer: NO_ANSWER,
                sources: [],
            });
        }

        // Fixed source contract, so a missing RPC column shows up as null
        // instead of vanishing from the response
        const sources = chunks.map(
            (chunk: Record<string, unknown>) => ({
                id: chunk.id ?? null,
                document_id: chunk.document_id ?? null,
                content: chunk.content ?? "",
                chunk_index: chunk.chunk_index ?? null,
                similarity: chunk.similarity ?? null,
            })
        );

        // Log every score so the threshold can be tuned from real numbers
        console.log(
            "Retrieval similarities:",
            sources.map((s: { similarity: number | null }) => s.similarity),
            "threshold:",
            minSimilarity
        );

        // 4. Keep only chunks relevant enough to ground an answer.
        // A null score means the search function did not report one, so it
        // stays in rather than being silently dropped.
        const relevant = sources.filter(
            (s: { similarity: number | null }) =>
                typeof s.similarity !== "number" ||
                s.similarity >= minSimilarity
        );

        // Nothing relevant — do not call the LLM, it would have to invent
        if (relevant.length === 0) {
            return NextResponse.json({
                success: true,
                question,
                answer: NO_ANSWER,
                sources: [],
                threshold: minSimilarity,
            });
        }

        // 5. Combine retrieved chunks into context
        const context = relevant
            .map(
                (chunk: { content: string; chunk_index: unknown }) =>
                    `Chunk ${chunk.chunk_index}:\n${chunk.content}`
            )
            .join("\n\n");

        // 6. Send context + question to the LLM
        const answer = await generateAnswer(
            question,
            context
        );

        return NextResponse.json({
            success: true,
            question,
            answer,
            sources: relevant,
            threshold: minSimilarity,
        });
    } catch (error) {
        console.error("Ask error:", error);

        return NextResponse.json(
            {
                success: false,
                error:
                    error instanceof Error
                        ? error.message
                        : error,
            },
            { status: 500 }
        );
    }
}