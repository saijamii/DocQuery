"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Project {
    id: string;
    name: string;
    created_at: string;
    document_count: number;
}

export default function ProjectsPage() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Create project state
    const [projectName, setProjectName] = useState("");
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState("");

    // Delete confirmation
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    useEffect(() => {
        loadProjects();
    }, []);

    async function loadProjects() {
        try {
            setLoading(true);
            setError("");

            const response = await fetch("/api/projects");
            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || "Failed to load projects");
            }

            setProjects(data.projects);
        } catch (err) {
            console.error(err);
            setError(
                err instanceof Error
                    ? `${err.message}. Reload the page to try again.`
                    : "Could not load projects. Reload the page to try again."
            );
        } finally {
            setLoading(false);
        }
    }

    async function createProject(e: React.FormEvent) {
        e.preventDefault();
        if (!projectName.trim()) return;

        setCreating(true);
        setCreateError("");

        try {
            const response = await fetch("/api/projects", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: projectName.trim() }),
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || "Failed to create project");
            }

            setProjectName("");
            await loadProjects();
        } catch (err) {
            console.error(err);
            setCreateError(
                err instanceof Error
                    ? `${err.message}. Check the name and try again.`
                    : "Could not create the project. Check the name and try again."
            );
        } finally {
            setCreating(false);
        }
    }

    async function deleteProject(projectId: string) {
        setDeletingId(projectId);

        try {
            const response = await fetch(`/api/projects/${projectId}`, {
                method: "DELETE",
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || "Failed to delete project");
            }

            setConfirmDeleteId(null);
            await loadProjects();
        } catch (err) {
            console.error(err);
            setError(
                err instanceof Error
                    ? `${err.message}. The project was not deleted.`
                    : "Could not delete the project. It was not deleted."
            );
        } finally {
            setDeletingId(null);
        }
    }

    return (
        <div className="min-h-screen bg-canvas text-ink font-sans antialiased">
            {/* Header */}
            <header className="sticky top-0 z-50 w-full border-b border-line bg-canvas/95 backdrop-blur-sm">
                <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
                    <div className="flex min-w-0 items-center gap-2.5">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] border border-line bg-elevated text-accent">
                            <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                            >
                                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                            </svg>
                        </div>
                        <span className="font-mono text-sm font-semibold tracking-wider text-white">
                            <span className="text-accent">.RAG</span>
                        </span>
                        <span className="text-line-strong">/</span>
                        <Link
                            href="/"
                            className="text-[13px] text-muted transition-colors hover:text-accent"
                        >
                            Workspace
                        </Link>
                        <span className="text-line-strong">/</span>
                        <span className="text-[13px] text-ink">Projects</span>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
                {/* Page header */}
                <section>
                    <p className="font-mono text-[11px] font-semibold uppercase tracking-[2px] text-accent">
                        DOCUMENT INTELLIGENCE
                    </p>
                    <h1 className="mt-2 text-[26px] font-semibold tracking-[-0.5px] text-white sm:text-[28px]">
                        Projects
                    </h1>
                    <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-muted">
                        Organize your documents into projects. Each project
                        groups related documents and defines the scope for
                        search and answers.
                    </p>
                </section>

                {/* Create project */}
                <section className="mt-8 border-y border-line py-5">
                    <h2 className="text-[15px] font-semibold text-white">
                        Create project
                    </h2>
                    <p className="mt-1.5 text-[12px] text-muted">
                        Give the project a name that describes the documents it
                        will hold.
                    </p>

                    <form onSubmit={createProject} className="mt-4 max-w-xl">
                        <label
                            htmlFor="project-name"
                            className="block text-[12px] font-medium text-ink"
                        >
                            New project name
                        </label>
                        <div className="mt-2 flex gap-2">
                            <input
                                id="project-name"
                                type="text"
                                value={projectName}
                                onChange={(e) => {
                                    setProjectName(e.target.value);
                                    if (createError) setCreateError("");
                                }}
                                placeholder="e.g. Product Documentation"
                                className="min-w-0 flex-1 rounded-[6px] border border-line bg-elevated px-3 py-2.5 text-[13px] text-ink placeholder-muted transition-colors focus:border-accent focus:outline-none"
                            />
                            <button
                                type="submit"
                                disabled={!projectName.trim() || creating}
                                className="shrink-0 rounded-[6px] bg-accent px-5 py-2.5 text-[13px] font-semibold text-canvas transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                {creating ? "Creating…" : "Create project"}
                            </button>
                        </div>
                        {createError && (
                            <p className="mt-2 text-[12px] text-red-400">
                                {createError}
                            </p>
                        )}
                    </form>
                </section>

                {/* Error */}
                {error && (
                    <p
                        role="alert"
                        className="mt-6 rounded-[6px] border border-red-500/40 bg-red-500/10 px-3 py-2 text-[12px] text-red-400"
                    >
                        {error}
                    </p>
                )}

                {/* Project list */}
                <section className="mt-8">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                        <h2 className="text-[16px] font-semibold text-white">
                            All projects
                        </h2>
                        {!loading && (
                            <span className="text-[12px] text-muted">
                                {projects.length}{" "}
                                {projects.length === 1
                                    ? "project"
                                    : "projects"}
                            </span>
                        )}
                    </div>

                    {loading && (
                        <p className="mt-6 text-[13px] text-muted">
                            Loading projects…
                        </p>
                    )}

                    {!loading && projects.length === 0 && (
                        <div className="mt-5 rounded-[8px] border border-dashed border-line p-10 text-center">
                            <p className="text-[13px] text-ink">
                                No projects yet
                            </p>
                            <p className="mt-1.5 text-[12px] text-muted">
                                Create your first project above, then upload
                                documents into it.
                            </p>
                        </div>
                    )}

                    {!loading && projects.length > 0 && (
                        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {projects.map((project) => (
                                <div
                                    key={project.id}
                                    className="rounded-[8px] border border-line bg-surface p-4 transition-colors hover:border-line-strong"
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <h3 className="truncate text-[14px] font-semibold text-ink">
                                            {project.name}
                                        </h3>
                                        <span className="shrink-0 text-[11px] text-accent">
                                            {project.document_count}{" "}
                                            {project.document_count === 1
                                                ? "document"
                                                : "documents"}
                                        </span>
                                    </div>

                                    <p className="mt-2 text-[11px] text-muted">
                                        Created{" "}
                                        {new Date(
                                            project.created_at
                                        ).toLocaleDateString()}
                                    </p>

                                    <div className="mt-4 flex items-center gap-2">
                                        <Link
                                            href={`/projects/${project.id}`}
                                            className="flex-1 rounded-[6px] border border-line bg-elevated px-3 py-2 text-center text-[12px] font-semibold text-accent transition-colors hover:border-accent/50"
                                        >
                                            Open
                                        </Link>

                                        {confirmDeleteId === project.id ? (
                                            <div className="flex gap-1.5">
                                                <button
                                                    onClick={() =>
                                                        deleteProject(
                                                            project.id
                                                        )
                                                    }
                                                    disabled={
                                                        deletingId ===
                                                        project.id
                                                    }
                                                    className="rounded-[6px] border border-red-500/50 bg-red-500/10 px-3 py-2 text-[12px] font-semibold text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-50"
                                                >
                                                    {deletingId === project.id
                                                        ? "Deleting…"
                                                        : "Confirm"}
                                                </button>
                                                <button
                                                    onClick={() =>
                                                        setConfirmDeleteId(null)
                                                    }
                                                    className="rounded-[6px] border border-line px-3 py-2 text-[12px] text-muted transition-colors hover:border-line-strong"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() =>
                                                    setConfirmDeleteId(
                                                        project.id
                                                    )
                                                }
                                                className="rounded-[6px] border border-line px-3 py-2 text-[12px] text-muted transition-colors hover:border-red-500/50 hover:text-red-400"
                                            >
                                                Delete
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
}
