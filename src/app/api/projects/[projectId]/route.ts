import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ projectId: string }> }
) {
    try {
        const { projectId } = await params;

        // Find all documents belonging to this project
        const { data: documents, error: docsError } =
            await supabase
                .from("documents")
                .select("id, file_path")
                .eq("project_id", projectId);

        if (docsError) {
            throw docsError;
        }

        // Delete storage files for each document
        if (documents && documents.length > 0) {
            const filePaths = documents
                .filter((doc) => doc.file_path)
                .map((doc) => doc.file_path);

            if (filePaths.length > 0) {
                const { error: storageError } =
                    await supabase.storage
                        .from("manuals")
                        .remove(filePaths);

                if (storageError) {
                    console.error(
                        "Storage cleanup error:",
                        storageError
                    );
                    // Continue even if storage cleanup fails
                }
            }
        }

        // Delete the project (cascade removes documents + chunks)
        const { error: deleteError } = await supabase
            .from("projects")
            .delete()
            .eq("id", projectId);

        if (deleteError) {
            throw deleteError;
        }

        return NextResponse.json({
            success: true,
            message: "Project deleted successfully",
        });
    } catch (error) {
        console.error("Project DELETE error:", error);

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
