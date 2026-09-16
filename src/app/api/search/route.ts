import { NextResponse } from "next/server";

import { createEmbedding } from "@/lib/embeddings";
import { supabase } from "@/lib/supabase";

export async function GET() {
    try {
        const question =
            "What does the battery warning light mean?";

        // 1. Convert question into an embedding
        const embedding = await createEmbedding(question);

        // 2. Search Supabase
        const { data, error } = await supabase.rpc(
            "match_document_chunks",
            {
                query_embedding: embedding,
                match_count: 5,
            }
        );

        if (error) {
            throw error;
        }

        return NextResponse.json({
            success: true,
            question,
            results: data,
        });
    } catch (error) {
        console.error("Search error:", error);

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