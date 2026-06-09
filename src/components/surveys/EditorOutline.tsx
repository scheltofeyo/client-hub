"use client";

import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  Plus,
  Search,
  Settings,
  Sparkles,
  Type,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/cn";
import { QUESTION_TYPE_META } from "./question-types";
import type { SurveyQuestionType } from "@/lib/surveys/types";

export type OutlineSelection =
  | { kind: "header" }
  | { kind: "archetypes" }
  | { kind: "closing" }
  | { kind: "section"; id: string }
  | { kind: "question"; sectionId: string; id: string };

export interface OutlineSection {
  id: string;
  title: string;
  questions: {
    id: string;
    title: string;
    type: SurveyQuestionType;
    incomplete?: boolean;
  }[];
}

export interface EditorOutlineProps {
  sections: OutlineSection[];
  selected: OutlineSelection;
  onSelect: (item: OutlineSelection) => void;
  onAddSection?: () => void;
  onReorderSections?: (ids: string[]) => void;
  onReorderQuestions?: (sectionId: string, ids: string[]) => void;
  archetypeLocked?: boolean;
  /** Whether to show the Archetypes config row (only relevant if archetype-ranking blocks exist) */
  showArchetypes?: boolean;
  /** Whether to show the legacy Closing question row (only when enabled on existing templates) */
  showClosing?: boolean;
}

function sameSelection(a: OutlineSelection, b: OutlineSelection): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "section" && b.kind === "section") return a.id === b.id;
  if (a.kind === "question" && b.kind === "question") return a.id === b.id;
  return true;
}

export default function EditorOutline({
  sections,
  selected,
  onSelect,
  onAddSection,
  onReorderSections,
  onReorderQuestions,
  archetypeLocked,
  showArchetypes = true,
  showClosing = true,
}: EditorOutlineProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const totalQuestions = useMemo(
    () => sections.reduce((sum, s) => sum + s.questions.length, 0),
    [sections]
  );
  const showSearch = totalQuestions > 20;
  const [query, setQuery] = useState("");
  const filteredSections = useMemo(() => {
    if (!query.trim()) return sections;
    const q = query.toLowerCase();
    return sections
      .map((s) => ({
        ...s,
        questions: s.questions.filter(
          (qq) => qq.title.toLowerCase().includes(q) || s.title.toLowerCase().includes(q)
        ),
      }))
      .filter((s) => s.title.toLowerCase().includes(q) || s.questions.length > 0);
  }, [sections, query]);

  // Selected section is always expanded; users can also expand/collapse manually.
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => {
    if (selected.kind === "section" || selected.kind === "question") {
      const sid = selected.kind === "section" ? selected.id : selected.sectionId;
      return new Set([sid]);
    }
    return new Set(sections.map((s) => s.id));
  });
  function toggleExpanded(sectionId: string) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  }

  function handleSectionDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sections.findIndex((s) => s.id === active.id);
    const newIndex = sections.findIndex((s) => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorderSections?.(arrayMove(sections, oldIndex, newIndex).map((s) => s.id));
  }
  function handleQuestionDragEnd(sectionId: string) {
    return (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const s = sections.find((x) => x.id === sectionId);
      if (!s) return;
      const oldIndex = s.questions.findIndex((q) => q.id === active.id);
      const newIndex = s.questions.findIndex((q) => q.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return;
      onReorderQuestions?.(sectionId, arrayMove(s.questions, oldIndex, newIndex).map((q) => q.id));
    };
  }

  return (
    <nav
      aria-label="Survey outline"
      className="h-full overflow-y-auto py-3"
      style={{ background: "var(--bg-sidebar)" }}
    >
      {showSearch && (
        <div className="px-3 mb-2">
          <div className="relative">
            <Search
              size={12}
              className="absolute left-2.5 top-1/2 -translate-y-1/2"
              style={{ color: "var(--text-muted)" }}
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a question…"
              className="input input-sm pl-7"
              aria-label="Search outline"
            />
          </div>
        </div>
      )}

      {/* Top fixed items — title weight matches the section-row hierarchy */}
      <OutlineRow
        selected={sameSelection(selected, { kind: "header" })}
        onClick={() => onSelect({ kind: "header" })}
        icon={<Type size={14} />}
        label="Header"
        bold
      />
      {showArchetypes && (
        <OutlineRow
          selected={sameSelection(selected, { kind: "archetypes" })}
          onClick={() => onSelect({ kind: "archetypes" })}
          icon={<Sparkles size={14} />}
          label="Archetypes"
          badge={archetypeLocked ? "Locked" : undefined}
          bold
        />
      )}
      {showClosing && (
        <OutlineRow
          selected={sameSelection(selected, { kind: "closing" })}
          onClick={() => onSelect({ kind: "closing" })}
          icon={<Settings size={14} />}
          label="Closing question"
          bold
        />
      )}

      {/* Sections group */}
      <GroupHeader label="Sections" />
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSectionDragEnd}>
        <SortableContext items={filteredSections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          {filteredSections.map((s) => {
            const sectionSelected =
              selected.kind === "section" && selected.id === s.id;
            const isExpanded = expandedSections.has(s.id);
            return (
              <SortableOutlineSection
                key={s.id}
                id={s.id}
                title={s.title}
                count={s.questions.length}
                selected={sectionSelected}
                expanded={isExpanded}
                onToggleExpand={() => toggleExpanded(s.id)}
                onSelect={() => onSelect({ kind: "section", id: s.id })}
              >
                {isExpanded && (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleQuestionDragEnd(s.id)}
                  >
                    <SortableContext items={s.questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
                      {s.questions.map((q) => {
                        const qSelected =
                          selected.kind === "question" && selected.id === q.id;
                        return (
                          <SortableOutlineQuestion
                            key={q.id}
                            id={q.id}
                            title={q.title}
                            type={q.type}
                            incomplete={q.incomplete}
                            selected={qSelected}
                            onSelect={() => onSelect({ kind: "question", sectionId: s.id, id: q.id })}
                          />
                        );
                      })}
                    </SortableContext>
                  </DndContext>
                )}
              </SortableOutlineSection>
            );
          })}
        </SortableContext>
      </DndContext>
      {onAddSection && (
        <div className="px-3 mt-1">
          <button
            type="button"
            onClick={onAddSection}
            className="btn-tertiary inline-flex items-center gap-1.5 px-2 py-1.5 rounded-button text-xs w-full justify-start"
          >
            <Plus size={12} />
            Add section
          </button>
        </div>
      )}

    </nav>
  );
}

// ── Internal sub-components ─────────────────────────────────────────

function GroupHeader({ label }: { label: string }) {
  return (
    <p
      className="typo-section-header mt-4 mb-1 px-3"
      style={{ color: "var(--text-muted)" }}
    >
      {label}
    </p>
  );
}

interface OutlineRowProps {
  selected: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  label: string;
  badge?: string;
  trailing?: React.ReactNode;
  dragHandle?: React.ReactNode;
  indent?: number;
  className?: string;
  /** Title-weight rows (sections, top-level items). Question rows stay regular weight. */
  bold?: boolean;
}

function OutlineRow({
  selected,
  onClick,
  icon,
  label,
  badge,
  trailing,
  dragHandle,
  indent = 0,
  className,
  bold = false,
}: OutlineRowProps) {
  return (
    <div
      className={cn(
        "group relative flex items-center gap-2 px-3 py-1.5 cursor-pointer text-sm transition-colors",
        className
      )}
      style={{
        background: selected ? "var(--primary-light)" : "transparent",
        color: selected ? "var(--primary)" : "var(--text-primary)",
        paddingLeft: `${12 + indent}px`,
        fontWeight: bold ? 600 : selected ? 500 : 400,
      }}
      onMouseEnter={(e) => {
        if (!selected) e.currentTarget.style.background = "var(--bg-hover)";
      }}
      onMouseLeave={(e) => {
        if (!selected) e.currentTarget.style.background = "transparent";
      }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-current={selected ? "page" : undefined}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {selected && (
        <span
          aria-hidden="true"
          className="absolute left-0 top-1 bottom-1"
          style={{ width: 3, background: "var(--primary)", borderRadius: 2 }}
        />
      )}
      {dragHandle}
      {icon && (
        <span style={{ color: selected ? "var(--primary)" : "var(--text-muted)" }} aria-hidden="true">
          {icon}
        </span>
      )}
      <span className="truncate flex-1">{label}</span>
      {badge && (
        <span
          className="text-[10px] px-1.5 py-0.5 rounded-badge"
          style={{ background: "var(--bg-neutral)", color: "var(--text-muted)" }}
        >
          {badge}
        </span>
      )}
      {trailing}
    </div>
  );
}

interface SortableSectionProps {
  id: string;
  title: string;
  count: number;
  selected: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onSelect: () => void;
  children?: React.ReactNode;
}

function SortableOutlineSection({
  id,
  title,
  count,
  selected,
  expanded,
  onToggleExpand,
  onSelect,
  children,
}: SortableSectionProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 10 : undefined,
      }}
    >
      <OutlineRow
        selected={selected}
        onClick={onSelect}
        bold
        icon={
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            className="btn-icon p-0.5 -ml-1"
            aria-label={expanded ? "Collapse section" : "Expand section"}
          >
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        }
        label={title}
        badge={`${count}`}
        dragHandle={
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="btn-icon p-0.5 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
            aria-label="Drag section"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical size={12} />
          </button>
        }
      />
      {expanded && children}
    </div>
  );
}

interface SortableQuestionProps {
  id: string;
  title: string;
  type: SurveyQuestionType;
  incomplete?: boolean;
  selected: boolean;
  onSelect: () => void;
}

function SortableOutlineQuestion({
  id,
  title,
  type,
  incomplete,
  selected,
  onSelect,
}: SortableQuestionProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const meta = QUESTION_TYPE_META[type];
  const TypeIcon = meta.icon;
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 10 : undefined,
      }}
    >
      <OutlineRow
        selected={selected}
        onClick={onSelect}
        indent={20}
        icon={<TypeIcon size={14} style={{ color: meta.color }} />}
        label={title || (type === "intro" ? "Info block" : "Untitled question")}
        badge={incomplete ? "•" : undefined}
        dragHandle={
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="btn-icon p-0.5 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
            aria-label="Drag question"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical size={12} />
          </button>
        }
      />
    </div>
  );
}
