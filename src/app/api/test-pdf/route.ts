import { NextResponse } from "next/server";
import path from "path";

import { extractTextFromPdf } from "@/lib/pdf";
import { splitIntoChunks } from "@/lib/chunk";
import fs from "fs";

export async function GET() {
    try {
        const filePath = path.join(
            process.cwd(),
            "manuals",
            "car-manual.pdf"
        );

        // Read the PDF file into a Uint8Array
        const fileBuffer = fs.readFileSync(filePath);
        const pdfData = new Uint8Array(fileBuffer);

        const text = await extractTextFromPdf(pdfData);

        const chunks = splitIntoChunks(text);

        return NextResponse.json({
            success: true,
            totalCharacters: text.length,
            totalChunks: chunks.length,
            firstChunk: chunks[0],
            secondChunk: chunks[1],
        });
    } catch (error) {
        console.error("PDF processing error:", error);

        return NextResponse.json(
            {
                success: false,
                error:
                    error instanceof Error
                        ? error.message
                        : String(error),
            },
            { status: 500 }
        );
    }
}