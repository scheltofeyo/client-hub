"use client";

import { Copy, Check, ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { useMemo, useState } from "react";
import type { AnalysisResult } from "@/lib/surveys/analyses";
import type { ResultsData } from "./types";
import { QuestionCard } from "./QuestionCard";
import { AnalysesSection } from "./AnalysesSection";

interface ResultsTabProps {
  results: ResultsData | null;
  loading: boolean;
  /** Public participant-facing share URL — used by the empty-state CTA. */
  shareUrl: string;
  /** Lookup for intro-block bodyHtml, keyed by questionId. */
  introBodyByQuestionId?: Record<string, string>;
  /** Whether the current viewer may create/edit/delete analyses. */
  canEditAnalyses?: boolean;
  onCreateAnalysis?: () => void;
  onEditAnalysis?: (analysis: AnalysisResult) => void;
  onDuplicateAnalysis?: (analysis: AnalysisResult) => void;
  onDeleteAnalysis?: (analysis: AnalysisResult) => void;
  onMoveAnalysisUp?: (analysis: AnalysisResult) => void;
  onMoveAnalysisDown?: (analysis: AnalysisResult) => void;
}

/**
 * Top-level Results-view: response-count header, expand/collapse-all
 * controls, then a vertical list of QuestionCards grouped by section.
 * Section titles render as plain text on the page background between
 * groups — no card chrome. Question expansion state lives here so the
 * Expand all / Collapse all buttons can drive every card at once.
 */
export function ResultsTab({
  results,
  loading,
  shareUrl,
  introBodyByQuestionId,
  canEditAnalyses = false,
  onCreateAnalysis,
  onEditAnalysis,
  onDuplicateAnalysis,
  onDeleteAnalysis,
  onMoveAnalysisUp,
  onMoveAnalysisDown,
}: ResultsTabProps) {
  const sectionTitleById = useMemo(
    () => new Map((results?.perSection ?? []).map((s) => [s.sectionId, s.title])),
    [results?.perSection]
  );

  const visibleQuestions = useMemo(
    () => (results?.perQuestion ?? []).filter((q) => q.type !== "intro"),
    [results?.perQuestion]
  );

  // Default everything open. Set tracks the IDs that are explicitly closed.
  const [closedIds, setClosedIds] = useState<Set<string>>(new Set());

  function toggleQuestion(qid: string, next?: boolean) {
    setClosedIds((prev) => {
      const isClosed = prev.has(qid);
      const willClose = next === undefined ? !isClosed : !next;
      const set = new Set(prev);
      if (willClose) set.add(qid);
      else set.delete(qid);
      return set;
    });
  }

  function expandAll() {
    setClosedIds(new Set());
  }

  function collapseAll() {
    setClosedIds(new Set(visibleQuestions.map((q) => q.questionId)));
  }

  if (loading || !results) {
    return (
      <div className="flex-1 flex items-center justify-center py-16">
        <div
          className="w-7 h-7 border-2 rounded-full animate-spin"
          style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }}
        />
      </div>
    );
  }

  const analyses = results.analyses ?? [];
  const hasAnalysesSection = canEditAnalyses || analyses.length > 0;

  if (results.participantCount === 0 && analyses.length === 0) {
    return <ResultsEmptyState shareUrl={shareUrl} />;
  }

  const allClosed = closedIds.size === visibleQuestions.length && visibleQuestions.length > 0;

  // Walk visibleQuestions in template order; emit a section-title node when sectionId changes.
  const groupedNodes: React.ReactNode[] = [];
  let lastSectionId: string | null = null;
  for (const q of visibleQuestions) {
    if (q.sectionId !== lastSectionId) {
      const title = sectionTitleById.get(q.sectionId) ?? "";
      groupedNodes.push(
        <SectionTitle key={`section-${q.sectionId}`} title={title} />
      );
      lastSectionId = q.sectionId;
    }
    groupedNodes.push(
      <QuestionCard
        key={q.questionId}
        question={q}
        archetypes={results.archetypes}
        introBodyByQuestionId={introBodyByQuestionId}
        open={!closedIds.has(q.questionId)}
        onToggle={() => toggleQuestion(q.questionId)}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
          {results.participantCount} respondent{results.participantCount === 1 ? "" : "s"}
        </p>
        <button
          type="button"
          onClick={allClosed ? expandAll : collapseAll}
          className="inline-flex items-center gap-1.5 rounded-button px-2.5 py-1 text-xs font-medium transition-colors hover:bg-surface"
          style={{ color: "var(--text-muted)" }}
        >
          {allClosed ? (
            <>
              <ChevronsUpDown size={13} />
              Show all
            </>
          ) : (
            <>
              <ChevronsDownUp size={13} />
              Collapse all
            </>
          )}
        </button>
      </div>

      {hasAnalysesSection && (
        <AnalysesSection
          analyses={analyses}
          questions={visibleQuestions}
          canEdit={canEditAnalyses}
          onCreate={onCreateAnalysis}
          onEdit={onEditAnalysis}
          onDuplicate={onDuplicateAnalysis}
          onDelete={onDeleteAnalysis}
          onMoveUp={onMoveAnalysisUp}
          onMoveDown={onMoveAnalysisDown}
        />
      )}

      {groupedNodes.length > 0 && (
        <div className="space-y-3">
          {analyses.length > 0 && (
            <h2 className="typo-section-header pt-4" style={{ color: "var(--text-muted)" }}>
              Questions
            </h2>
          )}
          {groupedNodes}
        </div>
      )}
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  if (!title) return null;
  return (
    <h2
      className="text-lg font-semibold tracking-tight pt-4 first:pt-0 px-1"
      style={{ color: "var(--text-primary)" }}
    >
      {title}
    </h2>
  );
}

function ResultsEmptyState({ shareUrl }: { shareUrl: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore — older browsers without clipboard API
    }
  }

  return (
    <div className="flex justify-center py-12">
      <div
        className="w-full max-w-md text-center rounded-card border bg-surface p-8 shadow-subtle"
        style={{ borderColor: "var(--border)" }}
      >
        <p className="typo-section-title" style={{ color: "var(--text-primary)" }}>
          No responses yet
        </p>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
          Share the survey link to invite participants. Answers appear here as they come in.
        </p>
        {shareUrl && (
          <button
            type="button"
            onClick={copy}
            className="btn-secondary border inline-flex items-center gap-1.5 mt-4 px-3 py-2 rounded-button text-sm"
            style={{ borderColor: "var(--border)" }}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Copied" : "Copy share link"}
          </button>
        )}
      </div>
    </div>
  );
}
