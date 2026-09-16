import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// GET — Review document: metadata + chunks
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ documentId: string }> }
) {
    try {
        const { documentId } = await params;

        // Get document metadata
        const { data: document, error: docError } =
            await supabase
                .from("documents")
                .select(
                    "id, file_name, file_path, project_id, created_at"
                )
                .eq("id", documentId)
                .single();

        if (docError) {
            throw docError;
        }

        // Get chunks ordered by chunk_index
        const { data: chunks, error: chunksError } =
            await supabase
                .from("document_chunks")
                .select(
                    "id, content, chunk_index, created_at"
                )
                .eq("document_id", documentId)
                .order("chunk_index", { ascending: true });

        if (chunksError) {
            throw chunksError;
        }

        return NextResponse.json({
            success: true,
            document,
            chunks: chunks || [],
        });
    } catch (error) {
        console.error("Document GET error:", error);

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

// DELETE — Delete document + storage file
export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ documentId: string }> }
) {
    try {
        const { documentId } = await params;

        // Get document to find file_path
        const { data: document, error: docError } =
            await supabase
                .from("documents")
                .select("id, file_path")
                .eq("id", documentId)
                .single();

        if (docError) {
            throw docError;
        }

        // Delete from Supabase Storage if file_path exists
        if (document.file_path) {
            const { error: storageError } =
                await supabase.storage
                    .from("manuals")
                    .remove([document.file_path]);

            if (storageError) {
                console.error(
                    "Storage cleanup error:",
                    storageError
                );
                // Continue even if storage cleanup fails
            }
        }

        // Delete the document (cascade removes chunks)
        const { error: deleteError } = await supabase
            .from("documents")
            .delete()
            .eq("id", documentId);

        if (deleteError) {
            throw deleteError;
        }

        return NextResponse.json({
            success: true,
            message: "Document deleted successfully",
        });
    } catch (error) {
        console.error("Document DELETE error:", error);

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
