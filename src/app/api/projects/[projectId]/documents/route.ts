import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ projectId: string }> }
) {
    try {
        const { projectId } = await params;

        // Get documents for this project
        const { data: documents, error: docsError } =
            await supabase
                .from("documents")
                .select("id, file_name, file_path, created_at")
                .eq("project_id", projectId)
                .order("created_at", { ascending: false });

        if (docsError) {
            throw docsError;
        }

        // Get chunk counts for each document
        const { data: chunks, error: chunksError } =
            await supabase
                .from("document_chunks")
                .select("id, document_id");

        if (chunksError) {
            throw chunksError;
        }

        const chunkCountMap: Record<string, number> = {};
        for (const chunk of chunks || []) {
            chunkCountMap[chunk.document_id] =
                (chunkCountMap[chunk.document_id] || 0) + 1;
        }

        const documentsWithCounts = (documents || []).map(
            (doc) => ({
                ...doc,
                chunk_count:
                    chunkCountMap[doc.id] || 0,
            })
        );

        return NextResponse.json({
            success: true,
            documents: documentsWithCounts,
        });
    } catch (error) {
        console.error(
            "Project documents GET error:",
            error
        );

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
