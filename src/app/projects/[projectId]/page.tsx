"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

interface DocumentRecord {
    id: string;
    file_name: string;
    file_path: string;
    created_at: string;
    chunk_count: number;
}

interface Chunk {
    id: string;
    content: string;
    chunk_index: number;
    created_at: string;
}

export default function ProjectDetailPage() {
    const params = useParams();
    const projectId = params.projectId as string;

    const [projectName, setProjectName] = useState("");
    const [documents, setDocuments] = useState<DocumentRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Upload state
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadMessage, setUploadMessage] = useState("");
    const [uploadSuccess, setUploadSuccess] = useState<boolean | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Inspection state
    const [reviewDocId, setReviewDocId] = useState<string | null>(null);
    const [reviewChunks, setReviewChunks] = useState<Chunk[]>([]);
    const [reviewLoading, setReviewLoading] = useState(false);

    // Delete state
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    useEffect(() => {
        loadProject();
        loadDocuments();
    }, [projectId]);

    async function loadProject() {
        try {
            const response = await fetch("/api/projects");
            const data = await response.json();

            if (data.success) {
                const project = data.projects.find(
                    (p: { id: string; name: string }) => p.id === projectId
                );
                if (project) {
                    setProjectName(project.name);
                }
            }
        } catch (err) {
            console.error("Failed to load project:", err);
        }
    }

    async function loadDocuments() {
        try {
            setLoading(true);
            setError("");

            const response = await fetch(
                `/api/projects/${projectId}/documents`
            );
            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || "Failed to load documents");
            }

            setDocuments(data.documents);
        } catch (err) {
            console.error(err);
            setError(
                err instanceof Error
                    ? `${err.message}. Reload the page to try again.`
                    : "Could not load documents. Reload the page to try again."
            );
        } finally {
            setLoading(false);
        }
    }

    async function uploadDocument() {
        if (!file) return;

        setUploading(true);
        setUploadMessage("");
        setUploadSuccess(null);

        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("projectId", projectId);

            const response = await fetch("/api/ingest", {
                method: "POST",
                body: formData,
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || "The file could not be indexed");
            }

            setUploadSuccess(true);
            setUploadMessage(
                `Indexed — ${data.totalChunks} searchable sections created.`
            );

            setFile(null);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }

            await loadDocuments();
        } catch (err) {
            console.error(err);
            setUploadSuccess(false);
            setUploadMessage(
                err instanceof Error
                    ? `${err.message}. Check that the file is a readable PDF, then upload again.`
                    : "Upload failed. Check the file and try again."
            );
        } finally {
            setUploading(false);
        }
    }

    async function inspectDocument(docId: string) {
        if (reviewDocId === docId) {
            setReviewDocId(null);
            setReviewChunks([]);
            return;
        }

        setReviewDocId(docId);
        setReviewLoading(true);
        setReviewChunks([]);

        try {
            const response = await fetch(`/api/documents/${docId}`);
            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || "Failed to load document");
            }

            setReviewChunks(data.chunks);
        } catch (err) {
            console.error(err);
            setError(
                err instanceof Error
                    ? `${err.message}. Try opening the document again.`
                    : "Could not load the indexed text for this document."
            );
        } finally {
            setReviewLoading(false);
        }
    }

    async function deleteDocument(docId: string) {
        setDeletingId(docId);

        try {
            const response = await fetch(`/api/documents/${docId}`, {
                method: "DELETE",
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || "Failed to delete document");
            }

            setConfirmDeleteId(null);

            if (reviewDocId === docId) {
                setReviewDocId(null);
                setReviewChunks([]);
            }

            await loadDocuments();
        } catch (err) {
            console.error(err);
            setError(
                err instanceof Error
                    ? `${err.message}. The document was not deleted.`
                    : "Could not delete the document. It was not deleted."
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
                            VOLTAGENT<span className="text-accent">.RAG</span>
                        </span>
                        <span className="text-line-strong">/</span>
                        <Link
                            href="/projects"
                            className="text-[13px] text-muted transition-colors hover:text-accent"
                        >
                            Projects
                        </Link>
                        <span className="text-line-strong">/</span>
                        <span className="truncate text-[13px] text-ink">
                            {projectName || "…"}
                        </span>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
                {/* Page header */}
                <section>
                    <Link
                        href="/projects"
                        className="mb-4 inline-flex items-center gap-1.5 text-[12px] text-muted transition-colors hover:text-accent"
                    >
                        <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <polyline points="15 18 9 12 15 6" />
                        </svg>
                        Back to projects
                    </Link>

                    <p className="font-mono text-[11px] font-semibold uppercase tracking-[2px] text-accent">
                        ACTIVE PROJECT
                    </p>
                    <h1 className="mt-2 text-[26px] font-semibold tracking-[-0.5px] text-white sm:text-[28px]">
                        {projectName || "Loading…"}
                    </h1>
                    <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-muted">
                        Upload, inspect, and manage the documents in this
                        project.
                    </p>
                </section>

                {/* Upload */}
                <section className="mt-8 border-y border-line py-5">
                    <h2 className="text-[15px] font-semibold text-white">
                        Upload documents
                    </h2>
                    <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
                        Add files to this project. Supported files will be
                        processed and indexed for search. PDF documents are
                        currently supported.
                    </p>

                    <div className="mt-4 max-w-xl space-y-3">
                        <label
                            htmlFor="document-file"
                            className="block text-[12px] font-medium text-ink"
                        >
                            Select document
                        </label>
                        <input
                            id="document-file"
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf"
                            onChange={(e) => {
                                setFile(e.target.files?.[0] || null);
                                setUploadMessage("");
                                setUploadSuccess(null);
                            }}
                            className="block w-full cursor-pointer text-[12px] text-muted file:mr-3 file:cursor-pointer file:rounded-[6px] file:border file:border-line file:bg-elevated file:px-3 file:py-2 file:text-[12px] file:font-semibold file:text-ink hover:file:border-accent/50"
                        />

                        {file && (
                            <div className="flex items-center justify-between gap-3 rounded-[6px] border border-line bg-elevated px-3 py-2 text-[12px]">
                                <span className="truncate font-mono text-ink">
                                    {file.name}
                                </span>
                                <span className="shrink-0 text-muted">
                                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                                </span>
                            </div>
                        )}

                        <button
                            onClick={uploadDocument}
                            disabled={!file || uploading}
                            className="flex items-center justify-center gap-2 rounded-[6px] bg-accent px-5 py-2.5 text-[13px] font-semibold text-canvas transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            {uploading ? "Indexing…" : "Upload & index"}
                        </button>

                        {uploadMessage && (
                            <p
                                role="status"
                                className={`rounded-[6px] border px-3 py-2 text-[12px] leading-relaxed ${
                                    uploadSuccess
                                        ? "border-accent/40 bg-accent/10 text-accent"
                                        : "border-red-500/40 bg-red-500/10 text-red-400"
                                }`}
                            >
                                {uploadMessage}
                            </p>
                        )}
                    </div>
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

                {/* Documents */}
                <section className="mt-8">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                        <div>
                            <p className="font-mono text-[11px] font-semibold uppercase tracking-[2px] text-muted">
                                PROJECT DOCUMENTS
                            </p>
                            <h2 className="mt-1.5 text-[16px] font-semibold text-white">
                                {projectName
                                    ? `Documents in ${projectName}`
                                    : "Documents"}
                            </h2>
                        </div>
                        {!loading && (
                            <span className="text-[12px] text-muted">
                                {documents.length}{" "}
                                {documents.length === 1
                                    ? "document"
                                    : "documents"}
                            </span>
                        )}
                    </div>

                    {loading && (
                        <p className="mt-6 text-[13px] text-muted">
                            Loading documents…
                        </p>
                    )}

                    {!loading && documents.length === 0 && (
                        <div className="mt-5 rounded-[8px] border border-dashed border-line p-10 text-center">
                            <p className="text-[13px] text-ink">
                                No documents yet
                            </p>
                            <p className="mt-1.5 text-[12px] text-muted">
                                Upload a PDF above to make it searchable in this
                                project.
                            </p>
                        </div>
                    )}

                    {!loading && documents.length > 0 && (
                        <div className="mt-5 space-y-3">
                            {documents.map((doc) => (
                                <div key={doc.id}>
                                    <div className="rounded-[8px] border border-line bg-surface p-4">
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="truncate text-[14px] font-medium text-ink">
                                                    {doc.file_name}
                                                </p>
                                                <p className="mt-1 text-[11px] text-muted">
                                                    {doc.chunk_count} indexed
                                                    sections · added{" "}
                                                    {new Date(
                                                        doc.created_at
                                                    ).toLocaleDateString()}
                                                </p>
                                            </div>

                                            <div className="flex shrink-0 items-center gap-2">
                                                <button
                                                    onClick={() =>
                                                        inspectDocument(doc.id)
                                                    }
                                                    aria-expanded={
                                                        reviewDocId === doc.id
                                                    }
                                                    className={`rounded-[6px] border px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                                                        reviewDocId === doc.id
                                                            ? "border-accent/50 bg-accent/10 text-accent"
                                                            : "border-line text-muted hover:border-accent/50 hover:text-accent"
                                                    }`}
                                                >
                                                    {reviewDocId === doc.id
                                                        ? "Close"
                                                        : "Inspect"}
                                                </button>

                                                {confirmDeleteId === doc.id ? (
                                                    <div className="flex gap-1.5">
                                                        <button
                                                            onClick={() =>
                                                                deleteDocument(
                                                                    doc.id
                                                                )
                                                            }
                                                            disabled={
                                                                deletingId ===
                                                                doc.id
                                                            }
                                                            className="rounded-[6px] border border-red-500/50 bg-red-500/10 px-3 py-1.5 text-[12px] font-semibold text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-50"
                                                        >
                                                            {deletingId ===
                                                            doc.id
                                                                ? "Deleting…"
                                                                : "Confirm"}
                                                        </button>
                                                        <button
                                                            onClick={() =>
                                                                setConfirmDeleteId(
                                                                    null
                                                                )
                                                            }
                                                            className="rounded-[6px] border border-line px-3 py-1.5 text-[12px] text-muted transition-colors hover:border-line-strong"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() =>
                                                            setConfirmDeleteId(
                                                                doc.id
                                                            )
                                                        }
                                                        className="rounded-[6px] border border-line px-3 py-1.5 text-[12px] text-muted transition-colors hover:border-red-500/50 hover:text-red-400"
                                                    >
                                                        Delete
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Indexed text, inline */}
                                    {reviewDocId === doc.id && (
                                        <div className="mt-2 rounded-[8px] border border-accent/30 bg-surface p-4">
                                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2.5">
                                                <p className="font-mono text-[11px] font-semibold uppercase tracking-[2px] text-accent">
                                                    INDEXED TEXT
                                                </p>
                                                <span className="font-mono text-[11px] text-muted">
                                                    {reviewChunks.length}{" "}
                                                    {reviewChunks.length === 1
                                                        ? "section"
                                                        : "sections"}
                                                </span>
                                            </div>

                                            {reviewLoading && (
                                                <p className="py-6 text-center text-[12px] text-muted">
                                                    Loading indexed text…
                                                </p>
                                            )}

                                            {!reviewLoading &&
                                                reviewChunks.length === 0 && (
                                                    <p className="py-6 text-center text-[12px] text-muted">
                                                        No indexed text found
                                                        for this document.
                                                    </p>
                                                )}

                                            {!reviewLoading &&
                                                reviewChunks.length > 0 && (
                                                    <div className="mt-3 max-h-[500px] space-y-3 overflow-y-auto pr-2">
                                                        {reviewChunks.map(
                                                            (chunk) => (
                                                                <article
                                                                    key={
                                                                        chunk.id
                                                                    }
                                                                    className="rounded-[6px] border border-line bg-elevated p-3.5"
                                                                >
                                                                    <div className="flex items-center justify-between border-b border-line pb-2">
                                                                        <span className="font-mono text-[12px] font-semibold text-accent">
                                                                            Chunk
                                                                            #
                                                                            {
                                                                                chunk.chunk_index
                                                                            }
                                                                        </span>
                                                                        <span className="font-mono text-[11px] text-muted">
                                                                            {
                                                                                chunk
                                                                                    .content
                                                                                    .length
                                                                            }{" "}
                                                                            chars
                                                                        </span>
                                                                    </div>
                                                                    <p className="mt-2.5 font-mono text-[12px] leading-relaxed whitespace-pre-wrap text-ink">
                                                                        {
                                                                            chunk.content
                                                                        }
                                                                    </p>
                                                                </article>
                                                            )
                                                        )}
                                                    </div>
                                                )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
}
