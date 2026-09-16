import { NextResponse } from "next/server";
import { createEmbedding } from "@/lib/embeddings";

export async function GET() {
    try {
        const embedding = await createEmbedding(
            "The battery warning light indicates a problem with the charging system."
        );

        return NextResponse.json({
            success: true,
            dimensions: Array.isArray(embedding)
                ? embedding.length
                : null,
            embedding,
        });
    } catch (error) {
        console.error(error);

        return NextResponse.json(
            {
                success: false,
                error: "Failed to create embedding",
            },
            { status: 500 }
        );
    }
}