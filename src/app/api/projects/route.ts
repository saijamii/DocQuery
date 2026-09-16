import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
    try {
        const { data: projects, error } = await supabase
            .from("projects")
            .select("id, name, created_at")
            .order("created_at", { ascending: false });

        if (error) {
            throw error;
        }

        // Get document counts per project
        const { data: documents, error: docError } = await supabase
            .from("documents")
            .select("id, project_id");

        if (docError) {
            throw docError;
        }

        const countMap: Record<string, number> = {};
        for (const doc of documents || []) {
            countMap[doc.project_id] =
                (countMap[doc.project_id] || 0) + 1;
        }

        const projectsWithCounts = (projects || []).map(
            (project) => ({
                ...project,
                document_count: countMap[project.id] || 0,
            })
        );

        return NextResponse.json({
            success: true,
            projects: projectsWithCounts,
        });
    } catch (error) {
        console.error("Projects GET error:", error);

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

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const name = body?.name?.trim();

        if (!name) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Project name is required",
                },
                { status: 400 }
            );
        }

        const { data, error } = await supabase
            .from("projects")
            .insert({ name })
            .select()
            .single();

        if (error) {
            throw error;
        }

        return NextResponse.json({
            success: true,
            project: data,
        });
    } catch (error) {
        console.error("Projects POST error:", error);

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
