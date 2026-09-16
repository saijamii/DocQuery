import { NextRequest, NextResponse } from "next/server";

import { extractTextFromPdf } from "@/lib/pdf";
import { splitIntoChunks } from "@/lib/chunk";
import { createEmbedding } from "@/lib/embeddings";
import { supabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();

        const file = formData.get("file") as File;
        const projectId = formData.get("projectId") as string;

        if (!file) {
            return NextResponse.json(
                { success: false, error: "PDF file is required" },
                { status: 400 }
            );
        }

        if (!projectId) {
            return NextResponse.json(
                { success: false, error: "Project is required" },
                { status: 400 }
            );
        }

        if (file.type !== "application/pdf") {
            return NextResponse.json(
                { success: false, error: "Only PDF files are allowed" },
                { status: 400 }
            );
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Upload PDF to Supabase Storage
        const filePath = `${projectId}/${file.name}`;

        const { error: uploadError } = await supabase.storage
            .from("manuals")
            .upload(filePath, buffer, {
                contentType: "application/pdf",
                upsert: true,
            });

        if (uploadError) {
            throw uploadError;
        }

        // Extract text directly from uploaded file
        const { data: pdfData, error: downloadError } =
            await supabase.storage
                .from("manuals")
                .download(filePath);

        if (downloadError) {
            throw downloadError;
        }

        const pdfBuffer = await pdfData.arrayBuffer();

        const text = await extractTextFromPdf(
            new Uint8Array(pdfBuffer)
        );

        const chunks = splitIntoChunks(text);

        // Create document record
        const { data: document, error: documentError } =
            await supabase
                .from("documents")
                .insert({
                    file_name: file.name,
                    file_path: filePath,
                    project_id: projectId,
                })
                .select()
                .single();

        if (documentError) {
            throw documentError;
        }

        // Create embeddings
        for (let i = 0; i < chunks.length; i++) {
            const embedding = await createEmbedding(chunks[i]);

            const { error: chunkError } = await supabase
                .from("document_chunks")
                .insert({
                    document_id: document.id,
                    content: chunks[i],
                    chunk_index: i,
                    embedding,
                });

            if (chunkError) {
                throw chunkError;
            }

            console.log(
                `Inserted chunk ${i + 1}/${chunks.length}`
            );
        }

        return NextResponse.json({
            success: true,
            documentId: document.id,
            fileName: file.name,
            totalChunks: chunks.length,
        });
    } catch (error) {
        console.error("Ingestion error:", error);

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