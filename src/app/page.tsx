"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import { AnswerMarkdown } from "@/components/answer-markdown";

interface Project {
  id: string;
  name: string;
  created_at?: string;
  document_count?: number;
}

interface DocumentRecord {
  id: string;
  file_name: string;
  project_id: string | null;
  created_at?: string;
}

interface RetrievedChunk {
  id?: string;
  content: string;
  chunk_index: number;
  similarity?: number;
  document_id?: string;
  page_number?: number | null;
  page?: number | null;
}

interface UploadProgress {
  stage: string;
  percent: number;
  current?: number;
  total?: number;
}

const NO_ANSWER = "I couldn't find the answer in the selected documents.";

export default function Home() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<RetrievedChunk[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [askError, setAskError] = useState("");

  // Project state
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [projectName, setProjectName] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
  const [projectError, setProjectError] = useState("");
  const [switchingProject, setSwitchingProject] = useState(false);

  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState<boolean | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(
    null
  );

  // Search scope
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  // ponytail: session state only, persist it once a tuned value is settled
  const [threshold, setThreshold] = useState(0.3);

  // Linking a source to the chunk it came from
  const [highlightedChunk, setHighlightedChunk] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chunkRefs = useRef<Record<string, HTMLElement | null>>({});
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
    },
    []
  );

  useEffect(() => {
    loadDocuments();
    loadProjects();
  }, []);

  async function loadDocuments() {
    try {
      const response = await fetch("/api/documents");
      const data = await response.json();

      if (data.success) {
        setDocuments(data.documents);
      }
    } catch (error) {
      console.error("Failed to load documents:", error);
    }
  }

  async function loadProjects() {
    try {
      const response = await fetch("/api/projects");
      const data = await response.json();

      if (data.success) {
        setProjects(data.projects);
      }
    } catch (error) {
      console.error("Failed to load projects:", error);
    }
  }

  async function createProject(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!projectName.trim()) return;

    setCreatingProject(true);
    setProjectError("");

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: projectName.trim() }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to create project");
      }

      setProjectName("");
      await loadProjects();
      setSelectedProjectId(data.project.id);
      setSwitchingProject(false);
    } catch (error) {
      console.error(error);
      setProjectError(
        error instanceof Error
          ? `${error.message}. Check the name and try again.`
          : "Could not create the project. Check the name and try again."
      );
    } finally {
      setCreatingProject(false);
    }
  }

  async function uploadFile() {
    if (!file || !selectedProjectId) return;

    setUploading(true);
    setUploadMessage("");
    setUploadSuccess(null);
    setUploadProgress({ stage: "Starting upload", percent: 2 });

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("projectId", selectedProjectId);

      const response = await fetch("/api/ingest", {
        method: "POST",
        body: formData,
      });

      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "The file could not be indexed");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let pending = "";
      let completed: { documentId: string; totalChunks: number } | null = null;

      while (true) {
        const { done, value } = await reader.read();
        pending += decoder.decode(value || new Uint8Array(), { stream: !done });
        const lines = pending.split("\n");
        pending = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as {
            type: string;
            stage?: string;
            percent?: number;
            current?: number;
            total?: number;
            documentId?: string;
            totalChunks?: number;
            error?: string;
          };

          if (event.type === "progress") {
            setUploadProgress({
              stage: event.stage || "Processing",
              percent: event.percent || 0,
              current: event.current,
              total: event.total,
            });
          } else if (event.type === "error") {
            throw new Error(event.error || "The file could not be indexed");
          } else if (event.type === "complete") {
            completed = {
              documentId: event.documentId || "",
              totalChunks: event.totalChunks || 0,
            };
          }
        }

        if (done) break;
      }

      if (!completed?.documentId) {
        throw new Error("The upload ended before indexing completed");
      }

      setUploadSuccess(true);
      setUploadMessage(
        `Indexed — ${completed.totalChunks} searchable sections created.`
      );

      await loadDocuments();
      setSelectedDocumentId(completed.documentId);

      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error(error);
      setUploadSuccess(false);
      setUploadMessage(
        error instanceof Error
          ? `${error.message}. Check that the file is a readable PDF, then upload again.`
          : "Upload failed. Check the file and try again."
      );
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }

  async function askQuestion() {
    if (!question.trim()) return;

    setLoading(true);
    setAnswer("");
    setSources([]);
    setAskError("");

    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question,
          documentId: effectiveDocumentId,
          projectId: selectedProjectId,
          threshold,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "The request did not complete");
      }

      setAnswer(data.answer || "");
      setSources(data.sources || []);
    } catch (error) {
      console.error(error);
      setAskError(
        error instanceof Error
          ? `${error.message}. Try asking again, or narrow the search scope.`
          : "Something went wrong. Try asking again."
      );
    } finally {
      setLoading(false);
    }
  }

  const activeProject = projects.find((p) => p.id === selectedProjectId);

  const projectDocuments = useMemo(
    () =>
      selectedProjectId
        ? documents.filter((doc) => doc.project_id === selectedProjectId)
        : documents,
    [documents, selectedProjectId]
  );

  // A document scope only holds while that document is in the active project;
  // otherwise the scope falls back to every document in the project.
  const activeDoc = projectDocuments.find(
    (doc) => doc.id === selectedDocumentId
  );
  const effectiveDocumentId = activeDoc ? activeDoc.id : "";

  function chunkKey(source: RetrievedChunk, index: number) {
    return source.id ?? `chunk-${index}`;
  }

  function describeSource(source: RetrievedChunk) {
    const doc = documents.find((d) => d.id === source.document_id);
    const page = source.page_number ?? source.page ?? null;

    return {
      name: doc?.file_name ?? "Unknown document",
      page: typeof page === "number" ? page : null,
    };
  }

  /** Jumps to the retrieved chunk a source row refers to, and flags it. */
  function focusChunk(key: string) {
    const node = chunkRefs.current[key];
    if (!node) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    node.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "center",
    });

    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    setHighlightedChunk(key);
    highlightTimer.current = setTimeout(() => setHighlightedChunk(null), 2400);
  }

  const scopeLabel = activeDoc
    ? activeDoc.file_name
    : activeProject
    ? `All documents in ${activeProject.name}`
    : "All documents";

  const trimmedAnswer = answer.trim();
  const modelFoundNothing =
    trimmedAnswer === NO_ANSWER ||
    /^i (?:couldn't|could not|cannot|can't) find/i.test(trimmedAnswer);
  const hasGroundedAnswer =
    trimmedAnswer !== "" && sources.length > 0 && !modelFoundNothing;

  return (
    <div className="min-h-screen bg-canvas text-ink font-sans antialiased selection:bg-accent/20 selection:text-accent">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-line bg-canvas/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] border border-line bg-elevated text-accent">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </div>
            <span className="font-mono text-sm font-semibold tracking-wider text-white">
              VOLTAGENT<span className="text-accent">.RAG</span>
            </span>
            <span className="text-line-strong">/</span>
            <span className="truncate text-[13px] text-muted">
              Document Workspace
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <Link
              href="/projects"
              className="rounded-[6px] border border-line px-3 py-1.5 text-[12px] font-medium text-muted transition-colors hover:border-accent/50 hover:text-accent"
            >
              Projects
            </Link>
            <div className="hidden items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-[12px] text-muted sm:flex">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
              </span>
              <span>System online</span>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
        {/* 1. Hero */}
        <section>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[2px] text-accent">
            DOCUMENT INTELLIGENCE
          </p>
          <h1 className="mt-2 text-[26px] font-semibold tracking-[-0.5px] text-white sm:text-[28px]">
            Ask your documents
          </h1>
          <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-muted">
            Upload documents, organize them into projects, and ask questions
            grounded in their content.
          </p>
        </section>

        {/* 2. Active project */}
        <section className="mt-8 border-y border-line py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[2px] text-muted">
                ACTIVE PROJECT
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                <span className="text-[16px] font-semibold text-white">
                  {activeProject ? activeProject.name : "No project selected"}
                </span>
                {activeProject && (
                  <>
                    <span className="text-line-strong">·</span>
                    <span className="text-[13px] text-muted">
                      {projectDocuments.length}{" "}
                      {projectDocuments.length === 1 ? "document" : "documents"}
                    </span>
                  </>
                )}
              </div>
            </div>

            <button
              onClick={() => setSwitchingProject((open) => !open)}
              aria-expanded={switchingProject}
              className="rounded-[6px] border border-line px-3.5 py-2 text-[13px] font-medium text-ink transition-colors hover:border-accent/50 hover:text-accent"
            >
              {switchingProject
                ? "Close"
                : activeProject
                ? "Change project"
                : "Choose project"}
            </button>
          </div>

          {!activeProject && !switchingProject && (
            <p className="mt-3 text-[13px] text-muted">
              Choose a project to start — it sets the document scope for the
              whole workspace.
            </p>
          )}

          {switchingProject && (
            <div className="mt-4 grid gap-5 border-t border-line pt-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="project-select"
                  className="block text-[12px] font-medium text-ink"
                >
                  Select a project
                </label>
                <select
                  id="project-select"
                  value={selectedProjectId}
                  onChange={(e) => {
                    setSelectedProjectId(e.target.value);
                    if (e.target.value) setSwitchingProject(false);
                  }}
                  className="mt-2 w-full cursor-pointer rounded-[6px] border border-line bg-elevated px-3 py-2.5 text-[13px] text-ink transition-colors focus:border-accent focus:outline-none"
                >
                  <option value="">No project selected</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
                {projects.length === 0 && (
                  <p className="mt-2 text-[12px] text-muted">
                    No projects yet. Create the first one on the right.
                  </p>
                )}
              </div>

              <form onSubmit={createProject}>
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
                      if (projectError) setProjectError("");
                    }}
                    placeholder="e.g. Product Documentation"
                    className="min-w-0 flex-1 rounded-[6px] border border-line bg-elevated px-3 py-2.5 text-[13px] text-ink placeholder-muted transition-colors focus:border-accent focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!projectName.trim() || creatingProject}
                    className="shrink-0 rounded-[6px] border border-line bg-elevated px-3.5 py-2.5 text-[13px] font-semibold text-accent transition-colors hover:border-accent/50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {creatingProject ? "Creating…" : "Create project"}
                  </button>
                </div>
                {projectError && (
                  <p className="mt-2 text-[12px] text-red-400">
                    {projectError}
                  </p>
                )}
              </form>
            </div>
          )}
        </section>

        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* 3. Left: upload + search scope */}
          <div className="space-y-8 lg:col-span-5">
            <section className="rounded-[8px] border border-line bg-surface p-5">
              <h2 className="text-[15px] font-semibold text-white">
                Upload documents
              </h2>
              <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
                Add files to the active project. Supported files will be
                processed and indexed for search. PDF documents are currently
                supported.
              </p>

              {!selectedProjectId && (
                <p className="mt-3 rounded-[6px] border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-300">
                  Select a project above before uploading — documents are stored
                  inside a project.
                </p>
              )}

              <div className="mt-4 space-y-3">
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

                {uploading && uploadProgress && (
                  <div
                    className="rounded-[6px] border border-line bg-elevated px-3 py-3"
                    aria-live="polite"
                  >
                    <div className="flex items-center justify-between gap-3 text-[12px]">
                      <span className="font-medium text-ink">
                        {uploadProgress.stage}
                      </span>
                      <span className="font-mono text-accent">
                        {uploadProgress.percent}%
                      </span>
                    </div>
                    <div
                      className="mt-2 h-1.5 overflow-hidden rounded-full bg-line"
                      role="progressbar"
                      aria-label="Document indexing progress"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={uploadProgress.percent}
                    >
                      <div
                        className="h-full rounded-full bg-accent transition-[width] duration-300"
                        style={{ width: `${uploadProgress.percent}%` }}
                      />
                    </div>
                    <p className="mt-2 text-[11px] text-muted">
                      {typeof uploadProgress.current === "number" &&
                      typeof uploadProgress.total === "number"
                        ? `Indexed ${uploadProgress.current} of ${uploadProgress.total} chunks`
                        : "Preparing document for indexing"}
                    </p>
                  </div>
                )}

                <button
                  onClick={uploadFile}
                  disabled={!file || !selectedProjectId || uploading}
                  className="flex w-full items-center justify-center gap-2 rounded-[6px] bg-accent px-4 py-2.5 text-[13px] font-semibold text-canvas transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {uploading ? (
                    <>
                      <Spinner className="text-canvas" />
                      <span>Indexing…</span>
                    </>
                  ) : (
                    <span>Upload &amp; index</span>
                  )}
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

            <section className="rounded-[8px] border border-line bg-surface p-5">
              <h2 className="text-[15px] font-semibold text-white">
                Search scope
              </h2>
              <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
                Choose which documents can be used to answer your question.
              </p>

              <div className="mt-4">
                <label htmlFor="scope-select" className="sr-only">
                  Search scope
                </label>
                <select
                  id="scope-select"
                  value={effectiveDocumentId}
                  onChange={(e) => setSelectedDocumentId(e.target.value)}
                  className="w-full cursor-pointer rounded-[6px] border border-line bg-elevated px-3 py-2.5 text-[13px] text-ink transition-colors focus:border-accent focus:outline-none"
                >
                  <option value="">
                    {activeProject
                      ? "All documents in this project"
                      : "All documents"}
                  </option>
                  {projectDocuments.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.file_name}
                    </option>
                  ))}
                </select>

                {selectedProjectId && projectDocuments.length === 0 ? (
                  <p className="mt-3 text-[12px] text-muted">
                    This project has no documents yet. Upload one above to make
                    it searchable.
                  </p>
                ) : (
                  <p className="mt-3 flex items-center gap-2 text-[12px] text-muted">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    <span className="truncate">Searching: {scopeLabel}</span>
                  </p>
                )}
              </div>

              <div className="mt-5 border-t border-line pt-4">
                <div className="flex items-baseline justify-between gap-3">
                  <label
                    htmlFor="threshold"
                    className="text-[12px] font-medium text-ink"
                  >
                    Minimum similarity
                  </label>
                  <span className="font-mono text-[12px] text-accent">
                    {threshold.toFixed(2)}
                  </span>
                </div>

                <input
                  id="threshold"
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  className="mt-3 w-full accent-accent"
                />

                <p className="mt-2 text-[12px] leading-relaxed text-muted">
                  Chunks scoring below this are dropped before the answer is
                  generated. Raise it for stricter grounding, lower it if
                  relevant chunks get rejected.
                </p>
              </div>
            </section>
          </div>

          {/* 4-6. Right: ask, answer, retrieved context */}
          <div className="space-y-8 lg:col-span-7">
            <section>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[2px] text-muted">
                ASK DOCUMENTS
              </p>

              <div className="mt-3 rounded-[8px] border border-line bg-surface p-5">
                <h2 className="text-[15px] font-semibold text-white">
                  Ask a question
                </h2>
                <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
                  Answers are generated from the documents in your selected
                  project.
                </p>

                <label htmlFor="question" className="sr-only">
                  Your question
                </label>
                <textarea
                  id="question"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      askQuestion();
                    }
                  }}
                  placeholder="What does the document say about...?"
                  rows={4}
                  className="mt-4 w-full resize-none rounded-[6px] border border-line bg-elevated p-3.5 text-[14px] leading-relaxed text-ink placeholder-muted transition-colors focus:border-accent focus:outline-none"
                />

                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="hidden items-center gap-2 text-[12px] text-muted sm:flex">
                    <kbd className="rounded-[4px] border border-line bg-elevated px-1.5 py-0.5 font-mono text-[11px]">
                      Ctrl + Enter
                    </kbd>
                    to submit
                  </p>

                  <button
                    onClick={askQuestion}
                    disabled={!question.trim() || loading}
                    className="ml-auto flex items-center gap-2 rounded-[6px] bg-accent px-5 py-2.5 text-[13px] font-semibold text-canvas transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {loading ? (
                      <>
                        <Spinner className="text-canvas" />
                        <span>Searching…</span>
                      </>
                    ) : (
                      <span>Ask</span>
                    )}
                  </button>
                </div>

                {askError && (
                  <p
                    role="alert"
                    className="mt-3 rounded-[6px] border border-red-500/40 bg-red-500/10 px-3 py-2 text-[12px] leading-relaxed text-red-400"
                  >
                    {askError}
                  </p>
                )}
              </div>
            </section>

            {/* Answer + sources */}
            {answer && (
              <section className="rounded-[8px] border border-line bg-surface p-5">
                <div className="flex items-center gap-2 border-b border-line pb-3">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                  <h2 className="text-[15px] font-semibold text-white">
                    Answer
                  </h2>
                </div>

                {hasGroundedAnswer ? (
                  <div className="mt-5">
                    <AnswerMarkdown markdown={answer} />
                  </div>
                ) : (
                  <div className="mt-5 max-w-[68ch]">
                    <p className="text-[14px] leading-[1.7] text-ink">
                      {NO_ANSWER}
                    </p>
                    <p className="mt-2.5 text-[13px] leading-[1.7] text-muted">
                      No chunk scored at or above {threshold.toFixed(2)}. Try
                      rephrasing the question, widening the search scope, or
                      lowering the minimum similarity.
                    </p>
                  </div>
                )}

                {hasGroundedAnswer && (
                  <div className="mt-8">
                    <h3 className="text-[13px] font-semibold text-white">
                      Sources
                    </h3>
                    <div className="mt-2 h-px w-full max-w-[68ch] bg-line" />

                    <ul className="mt-3 max-w-[68ch] divide-y divide-line/60">
                      {sources.map((source, index) => {
                        const meta = describeSource(source);
                        const key = chunkKey(source, index);

                        return (
                          <li key={key}>
                            <button
                              onClick={() => focusChunk(key)}
                              className="group w-full py-2.5 text-left transition-colors"
                              aria-label={`Show retrieved text from ${meta.name}${
                                meta.page !== null
                                  ? `, page ${meta.page}`
                                  : ""
                              }`}
                            >
                              <span className="block truncate font-mono text-[13px] text-ink transition-colors group-hover:text-accent">
                                {meta.name}
                              </span>
                              <span className="mt-0.5 block font-mono text-[11px] text-muted">
                                {meta.page !== null
                                  ? `Page ${meta.page}`
                                  : `Chunk #${source.chunk_index}`}
                                {" · Similarity "}
                                {typeof source.similarity === "number"
                                  ? source.similarity.toFixed(4)
                                  : "n/a"}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </section>
            )}

            {/* Retrieved context */}
            {sources.length > 0 && (
              <section>
                <div className="flex items-center justify-between gap-3">
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-[2px] text-muted">
                    RETRIEVED CONTEXT
                  </p>
                  <span className="font-mono text-[12px] text-accent">
                    {sources.length}{" "}
                    {sources.length === 1 ? "match" : "matches"}
                  </span>
                </div>

                <div className="mt-3 space-y-3">
                  {sources.map((source, index) => {
                    const meta = describeSource(source);
                    const key = chunkKey(source, index);

                    return (
                      <article
                        key={key}
                        ref={(node) => {
                          chunkRefs.current[key] = node;
                        }}
                        className={`scroll-mt-20 rounded-[8px] border bg-surface p-4 transition-colors ${
                          highlightedChunk === key
                            ? "border-accent"
                            : "border-line"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-line pb-2.5">
                          <span className="font-mono text-[12px] font-semibold text-accent">
                            Chunk #{source.chunk_index}
                            <span className="font-normal text-muted">
                              {" · "}Similarity{" "}
                              {typeof source.similarity === "number"
                                ? source.similarity.toFixed(4)
                                : "n/a"}
                            </span>
                          </span>
                          <span className="font-mono text-[11px] text-muted">
                            {meta.name}
                            {meta.page !== null && ` · page ${meta.page}`}
                          </span>
                        </div>

                        <p className="mt-2.5 font-mono text-[12px] leading-relaxed whitespace-pre-wrap text-ink">
                          {source.content}
                        </p>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        </div>

        {/* 7. Bottom: project documents */}
        <section className="mt-12 border-t border-line pt-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[2px] text-muted">
                PROJECT DOCUMENTS
              </p>
              <h2 className="mt-1.5 text-[16px] font-semibold text-white">
                {activeProject
                  ? `Documents in ${activeProject.name}`
                  : "All documents"}
              </h2>
            </div>
            <span className="text-[12px] text-muted">
              {projectDocuments.length}{" "}
              {projectDocuments.length === 1 ? "document" : "documents"}
            </span>
          </div>

          {projectDocuments.length === 0 ? (
            <div className="mt-5 rounded-[8px] border border-dashed border-line p-8 text-center">
              <p className="text-[13px] text-ink">No documents yet</p>
              <p className="mt-1.5 text-[12px] text-muted">
                {activeProject
                  ? "Upload a PDF to this project to make it searchable."
                  : "Choose a project above, then upload a document."}
              </p>
            </div>
          ) : (
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {projectDocuments.map((doc) => {
                const isSelected = doc.id === selectedDocumentId;
                const docProject = projects.find(
                  (p) => p.id === doc.project_id
                );

                return (
                  <button
                    key={doc.id}
                    onClick={() =>
                      setSelectedDocumentId(isSelected ? "" : doc.id)
                    }
                    aria-pressed={isSelected}
                    className={`rounded-[8px] border p-4 text-left transition-colors ${
                      isSelected
                        ? "border-accent bg-accent/5"
                        : "border-line bg-surface hover:border-line-strong"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="truncate font-mono text-[12px] font-medium text-ink">
                        {doc.file_name}
                      </span>
                      {isSelected && (
                        <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-canvas">
                          IN SCOPE
                        </span>
                      )}
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-muted">
                      {!selectedProjectId && docProject ? (
                        <span className="truncate text-accent">
                          {docProject.name}
                        </span>
                      ) : (
                        <span>Indexed</span>
                      )}
                      {doc.created_at && (
                        <span className="shrink-0">
                          {new Date(doc.created_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`h-4 w-4 animate-spin ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
