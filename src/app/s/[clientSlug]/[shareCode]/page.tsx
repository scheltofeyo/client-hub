"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowRight, Check, GripVertical, MessageCircle } from "lucide-react";
import {
  TOP3_RANK_LENGTH,
  isFullRankingType,
  isTop3Type,
  type SurveyQuestionType,
} from "@/lib/surveys/types";
import LocaleSwitcher, { type Locale } from "@/components/ui/LocaleSwitcher";
import { t } from "@/lib/surveys/translations";
import { pickGreeting, type Greeting } from "@/lib/surveys/greetings";
import { estimateSurveyMinutes } from "@/lib/surveys/time-estimate";

// Public-side types — match the trimmed shape returned by the public GET endpoint.
interface PublicQuestion {
  id: string;
  type: SurveyQuestionType;
  title: string;
  description?: string;
  order: number;
  options?: { id: string; text: string }[];
  rankingItems?: { id: string; text: string }[];
  choiceMode?: "single" | "multi";
  choices?: { id: string; text: string }[];
  maxSelections?: number;
  placeholder?: string;
  multiline?: boolean;
  required?: boolean;
  bodyHtml?: string;
}

interface Section {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  order: number;
  openQuestion?: { enabled: boolean; label: string };
  questions: PublicQuestion[];
}

interface SurveyData {
  status: string;
  title: string;
  description?: string;
  message?: string;
  clientCompany?: string;
  clientPrimaryColor?: string;
  template?: {
    name: string;
    description?: string;
    closingOpenQuestion?: { enabled: boolean; label: string };
    sections: Section[];
  };
}

function fisherYates<T>(arr: T[]): T[] {
  const next = [...arr];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function rankingItemIds(q: PublicQuestion): string[] {
  if (q.type === "archetype-ranking" || q.type === "archetype-top3") {
    return (q.options ?? []).map((o) => o.id);
  }
  if (q.type === "general-ranking" || q.type === "general-top3") {
    return (q.rankingItems ?? []).map((i) => i.id);
  }
  return [];
}

// ── Ranking state ───────────────────────────────────────────────────
// Two shapes, discriminated by `kind`:
//  - "top3": pool + N slots (N = TOP3_RANK_LENGTH). Participants drag items
//    from the pool into ranked slots; items can move back to the pool.
//  - "rank-all": a single ordered list. Items start in a randomized order
//    and the participant reorders them in place — no pool, no empty slots.

type Top3State = { kind: "top3"; ranked: (string | null)[]; pool: string[] };
type RankAllState = { kind: "rank-all"; order: string[] };
type RankingState = Top3State | RankAllState;

const SLOT_ID_SEP = "::slot::";
const POOL_ID_SEP = "::pool";

function slotDroppableId(qid: string, index: number): string {
  return `${qid}${SLOT_ID_SEP}${index}`;
}

function poolDroppableId(qid: string): string {
  return `${qid}${POOL_ID_SEP}`;
}

function parseSlotIndex(id: string, qid: string): number | null {
  const prefix = `${qid}${SLOT_ID_SEP}`;
  if (!id.startsWith(prefix)) return null;
  const n = Number(id.slice(prefix.length));
  return Number.isFinite(n) ? n : null;
}

function findNearestEmptySlot(ranked: (string | null)[], target: number): number {
  for (let i = target + 1; i < ranked.length; i++) {
    if (ranked[i] === null) return i;
  }
  for (let i = target - 1; i >= 0; i--) {
    if (ranked[i] === null) return i;
  }
  return -1;
}

function insertWithCascade(
  ranked: (string | null)[],
  pool: string[],
  target: number,
  item: string
): { ranked: (string | null)[]; pool: string[] } {
  const nextRanked = [...ranked];
  const nextPool = pool.filter((id) => id !== item);
  const emptyIdx = findNearestEmptySlot(nextRanked, target);
  if (emptyIdx === -1) {
    // No empty slot — push the last item back to the pool, then shift.
    const popped = nextRanked[nextRanked.length - 1];
    if (popped !== null) nextPool.push(popped);
    for (let i = nextRanked.length - 1; i > target; i--) {
      nextRanked[i] = nextRanked[i - 1];
    }
  } else if (emptyIdx > target) {
    for (let i = emptyIdx; i > target; i--) {
      nextRanked[i] = nextRanked[i - 1];
    }
  } else {
    for (let i = emptyIdx; i < target; i++) {
      nextRanked[i] = nextRanked[i + 1];
    }
  }
  nextRanked[target] = item;
  return { ranked: nextRanked, pool: nextPool };
}

function computeNextTop3(
  state: Top3State,
  activeId: string,
  fromZone: "slot" | "pool",
  overId: string,
  qid: string
): Top3State {
  const targetSlot = parseSlotIndex(overId, qid);
  const targetIsPool = overId === poolDroppableId(qid);

  if (fromZone === "pool" && targetIsPool) return state;
  if (fromZone === "pool" && targetSlot === null && !targetIsPool) return state;

  if (fromZone === "pool" && targetSlot !== null) {
    if (state.ranked[targetSlot] === null) {
      const ranked = [...state.ranked];
      ranked[targetSlot] = activeId;
      return { kind: "top3", ranked, pool: state.pool.filter((id) => id !== activeId) };
    }
    const next = insertWithCascade(state.ranked, state.pool, targetSlot, activeId);
    return { kind: "top3", ranked: next.ranked, pool: next.pool };
  }

  if (fromZone === "slot") {
    const fromIdx = state.ranked.indexOf(activeId);
    if (fromIdx < 0) return state;

    if (targetIsPool) {
      const ranked = [...state.ranked];
      ranked[fromIdx] = null;
      return { kind: "top3", ranked, pool: [...state.pool, activeId] };
    }

    if (targetSlot !== null && targetSlot !== fromIdx) {
      const ranked = [...state.ranked];
      if (ranked[targetSlot] === null) {
        ranked[targetSlot] = activeId;
        ranked[fromIdx] = null;
        return { kind: "top3", ranked, pool: state.pool };
      }
      // Target is filled — cascade towards source slot via arrayMove semantics.
      const [moved] = ranked.splice(fromIdx, 1);
      ranked.splice(targetSlot, 0, moved);
      return { kind: "top3", ranked, pool: state.pool };
    }
  }

  return state;
}

type Screen =
  | { kind: "identity" }
  | { kind: "section-intro"; sectionId: string; sectionIndex: number; totalSections: number }
  | {
      kind: "question";
      questionId: string;
      sectionId: string;
      sectionIndex: number;
      totalSections: number;
      qIndexInSection: number;
      qTotalInSection: number;
    }
  | { kind: "closing" }
  | { kind: "done" };

function buildScreens(sections: Section[], hasClosing: boolean): Screen[] {
  const screens: Screen[] = [{ kind: "identity" }];
  sections.forEach((section, sectionIndex) => {
    screens.push({
      kind: "section-intro",
      sectionId: section.id,
      sectionIndex,
      totalSections: sections.length,
    });
    const qs = section.questions ?? [];
    qs.forEach((q, qIndex) => {
      screens.push({
        kind: "question",
        questionId: q.id,
        sectionId: section.id,
        sectionIndex,
        totalSections: sections.length,
        qIndexInSection: qIndex,
        qTotalInSection: qs.length,
      });
    });
  });
  if (hasClosing) screens.push({ kind: "closing" });
  screens.push({ kind: "done" });
  return screens;
}

const screenVariants = {
  enter: (dir: 1 | -1) => ({ y: dir > 0 ? 24 : -24, opacity: 0 }),
  center: { y: 0, opacity: 1 },
  exit: (dir: 1 | -1) => ({ y: dir > 0 ? -24 : 24, opacity: 0 }),
};

function SummLogoMark() {
  return (
    <svg width="60" height="24" viewBox="0 0 1359 535" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="SUMM">
        <path d="M539.326 325.462C545.014 325.462 549.717 324.988 553.418 324.04C557.119 323.092 560.09 321.798 562.333 320.157C564.575 318.516 566.125 316.584 566.981 314.342C567.838 312.1 568.276 309.602 568.276 306.85C568.276 300.998 565.523 296.112 559.999 292.247C554.476 288.364 544.996 284.189 531.56 279.705C525.69 277.645 519.839 275.275 513.987 272.595C508.117 269.934 502.866 266.561 498.218 262.514C493.569 258.466 489.777 253.544 486.842 247.784C483.907 242.005 482.449 234.986 482.449 226.709C482.449 218.433 483.998 210.977 487.097 204.341C490.196 197.705 494.59 192.055 500.278 187.406C505.965 182.758 512.856 179.184 520.969 176.669C529.063 174.171 538.196 172.913 548.368 172.913C560.437 172.913 570.864 174.207 579.651 176.796C588.438 179.385 595.675 182.229 601.363 185.328L589.732 217.121C584.737 214.532 579.177 212.253 573.052 210.266C566.927 208.279 559.562 207.295 550.939 207.295C541.277 207.295 534.35 208.626 530.12 211.306C525.891 213.985 523.794 218.069 523.794 223.592C523.794 226.874 524.578 229.626 526.128 231.869C527.677 234.111 529.883 236.135 532.727 237.939C535.571 239.744 538.852 241.385 542.553 242.843C546.254 244.302 550.356 245.815 554.84 247.364C564.156 250.81 572.25 254.219 579.141 257.573C586.032 260.928 591.774 264.866 596.332 269.332C600.889 273.817 604.298 279.067 606.541 285.101C608.783 291.135 609.895 298.463 609.895 307.086C609.895 323.803 604.025 336.783 592.321 346.008C580.599 355.232 562.934 359.844 539.326 359.844C531.396 359.844 524.25 359.369 517.87 358.421C511.489 357.473 505.838 356.307 500.934 354.921C496.03 353.536 491.801 352.078 488.264 350.529C484.727 348.979 481.756 347.52 479.35 346.135L490.725 314.069C496.067 317.004 502.666 319.628 510.505 321.961C518.325 324.313 527.951 325.462 539.326 325.462Z" fill="var(--text-muted)" />
        <path d="M710.998 359.862C698.42 359.862 687.554 358.094 678.421 354.558C669.288 351.021 661.741 346.117 655.798 339.828C649.855 333.538 645.461 326.046 642.617 317.332C639.774 308.636 638.352 299.011 638.352 288.51V177.069H678.695V285.137C678.695 292.375 679.515 298.537 681.156 303.623C682.796 308.709 685.039 312.847 687.883 316.037C690.726 319.227 694.172 321.506 698.219 322.892C702.266 324.277 706.714 324.952 711.527 324.952C721.353 324.952 729.319 321.944 735.445 315.91C741.57 309.875 744.614 299.63 744.614 285.137V177.069H784.958V288.51C784.958 299.029 783.499 308.672 780.564 317.459C777.629 326.246 773.144 333.794 767.11 340.083C761.076 346.372 753.401 351.239 744.104 354.685C734.788 358.13 723.759 359.862 710.998 359.862Z" fill="var(--text-muted)" />
        <path d="M871.295 177.051C874.412 182.739 877.985 189.758 882.05 198.125C886.116 206.493 890.345 215.535 894.757 225.27C899.169 235.005 903.526 244.958 907.846 255.131C912.167 265.303 916.232 274.873 920.024 283.824C923.834 274.855 927.881 265.303 932.201 255.131C936.522 244.958 940.879 235.005 945.29 225.27C949.702 215.535 953.932 206.475 957.997 198.125C962.062 189.758 965.653 182.739 968.753 177.051H1005.49C1007.2 188.937 1008.8 202.264 1010.26 216.994C1011.72 231.723 1013.02 247.073 1014.15 263.024C1015.26 278.976 1016.3 294.963 1017.24 310.987C1018.19 327.011 1019.01 342.106 1019.71 356.234H980.402C979.891 338.825 979.198 319.865 978.342 299.356C977.485 278.847 976.19 258.156 974.459 237.301C971.341 244.538 967.877 252.56 964.086 261.346C960.276 270.133 956.52 278.921 952.801 287.726C949.082 296.513 945.491 304.917 942.046 312.938C938.582 320.959 935.647 327.813 933.222 333.501H905.039C902.614 327.813 899.679 320.959 896.215 312.938C892.752 304.917 889.16 296.513 885.441 287.726C881.722 278.939 877.967 270.152 874.157 261.346C870.347 252.56 866.901 244.538 863.784 237.301C862.052 258.156 860.758 278.847 859.901 299.356C859.044 319.865 858.351 338.825 857.841 356.234H818.537C819.23 342.106 820.05 327.011 820.998 310.987C821.946 294.963 822.985 278.976 824.097 263.024C825.209 247.091 826.504 231.742 827.98 216.994C829.439 202.264 831.043 188.937 832.757 177.051H871.295Z" fill="var(--text-muted)" />
        <path d="M1103.22 177.051C1106.33 182.739 1109.91 189.758 1113.97 198.125C1118.04 206.493 1122.27 215.535 1126.68 225.27C1131.09 235.005 1135.45 244.958 1139.77 255.131C1144.09 265.303 1148.15 274.873 1151.95 283.824C1155.76 274.855 1159.8 265.303 1164.12 255.131C1168.44 244.958 1172.8 235.005 1177.21 225.27C1181.62 215.535 1185.85 206.475 1189.92 198.125C1193.98 189.758 1197.56 182.739 1200.68 177.051H1237.39C1239.1 188.937 1240.71 202.264 1242.17 216.994C1243.63 231.723 1244.92 247.073 1246.05 263.024C1247.16 278.976 1248.2 294.963 1249.15 310.987C1250.1 327.011 1250.92 342.106 1251.61 356.234H1212.31C1211.8 338.825 1211.1 319.865 1210.25 299.356C1209.39 278.847 1208.09 258.156 1206.36 237.301C1203.25 244.538 1199.78 252.56 1195.99 261.346C1192.18 270.133 1188.42 278.921 1184.71 287.726C1180.99 296.513 1177.4 304.917 1173.95 312.938C1170.49 320.959 1167.55 327.813 1165.13 333.501H1136.94C1134.52 327.813 1131.58 320.959 1128.12 312.938C1124.66 304.917 1121.06 296.513 1117.35 287.726C1113.63 278.939 1109.87 270.152 1106.06 261.346C1102.25 252.56 1098.81 244.538 1095.69 237.301C1093.96 258.156 1092.66 278.847 1091.81 299.356C1090.95 319.865 1090.26 338.825 1089.75 356.234H1050.44C1051.13 342.106 1051.95 327.011 1052.9 310.987C1053.85 294.963 1054.89 278.976 1056 263.024C1057.11 247.091 1058.41 231.742 1059.88 216.994C1061.34 202.264 1062.95 188.937 1064.66 177.051H1103.22Z" fill="var(--text-muted)" />
        <path d="M252.875 275.822H158.516L125.228 309.109C99.2507 335.087 99.2689 377.18 125.228 403.158C151.188 429.117 193.299 429.136 219.277 403.158L252.893 369.542V275.822H252.875Z" fill="#402D9B" />
        <path d="M350.77 134.229C362.437 134.229 373.412 138.768 381.67 147.026C398.715 164.071 398.715 191.782 381.67 208.827L355.364 235.132H293.254V173.642L319.87 147.026C328.128 138.768 339.103 134.229 350.77 134.229ZM350.77 111.423C333.743 111.423 316.735 117.914 303.755 130.893L270.467 167.554V257.92H360.979L397.804 224.942C423.781 198.964 423.763 156.871 397.804 130.893C384.806 117.914 367.797 111.423 350.77 111.423Z" fill="#402D9B" />
        <path d="M397.786 403.304C423.764 377.326 423.746 335.233 397.786 309.256C397.786 309.256 362.11 276.278 360.961 276.278H270.449V369.542L303.737 403.304C329.715 429.282 371.826 429.282 397.786 403.304Z" fill="#9381EA" />
        <path d="M252.876 258.084V167.571C252.876 166.605 219.26 130.747 219.26 130.747C193.3 104.769 151.189 104.769 125.211 130.747C99.2513 156.725 99.2331 198.818 125.211 224.795L158.499 258.084H252.876Z" fill="#6F3FF3" />
    </svg>
  );
}

export default function PublicSurveyPage() {
  const { shareCode } = useParams<{ shareCode: string }>();
  const [survey, setSurvey] = useState<SurveyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [locale, setLocale] = useState<Locale>("en");

  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [email, setEmail] = useState("");
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [saveState, setSaveState] = useState<"saved" | "unsaved" | null>(null);
  const markDirty = useCallback(() => {
    setSaveState((prev) => (prev === null ? prev : "unsaved"));
  }, []);

  const [rankingState, setRankingState] = useState<Record<string, RankingState>>({});
  const [rankingLabels, setRankingLabels] = useState<
    Record<string, Record<string, string>>
  >({});
  const [choices, setChoices] = useState<Record<string, string[]>>({});
  const [openTexts, setOpenTexts] = useState<Record<string, string>>({});

  const [closingText, setClosingText] = useState("");

  const [error, setErrorMessage] = useState<string | null>(null);
  const [errorToken, setErrorToken] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  // Greet the participant differently each visit — locked once per mount so
  // the headline doesn't reshuffle between renders.
  const [greeting] = useState<Greeting>(() => pickGreeting());

  const reducedMotion = useReducedMotion();

  const setError = useCallback((message: string | null) => {
    setErrorMessage(message);
    if (message !== null) setErrorToken((t) => t + 1);
  }, []);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setErrorMessage(null), 5000);
    return () => clearTimeout(timer);
  }, [error, errorToken]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    fetch(`/api/public/surveys/${shareCode}`)
      .then((r) => r.json())
      .then((data: SurveyData) => {
        if (data?.template?.sections) {
          const init: Record<string, RankingState> = {};
          const labels: Record<string, Record<string, string>> = {};
          for (const s of data.template.sections) {
            for (const q of s.questions ?? []) {
              const ids = rankingItemIds(q);
              if (ids.length === 0) continue;
              const shuffled = fisherYates(ids);
              const labelMap: Record<string, string> = {};
              shuffled.forEach((id, i) => {
                labelMap[id] = String.fromCharCode(65 + i);
              });
              labels[q.id] = labelMap;
              if (isTop3Type(q.type)) {
                init[q.id] = {
                  kind: "top3",
                  ranked: Array(TOP3_RANK_LENGTH).fill(null),
                  pool: shuffled,
                };
              } else if (isFullRankingType(q.type)) {
                init[q.id] = { kind: "rank-all", order: shuffled };
              }
            }
          }
          setRankingState(init);
          setRankingLabels(labels);
        }
        setSurvey(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [shareCode]);

  const sections = useMemo(() => survey?.template?.sections ?? [], [survey]);
  const closingEnabled = !!survey?.template?.closingOpenQuestion?.enabled;
  const screens = useMemo(() => buildScreens(sections, closingEnabled), [sections, closingEnabled]);
  const totalSteps = screens.length;
  const current = screens[step] ?? screens[screens.length - 1];
  const isDoneStep = current.kind === "done";

  const questionsById = useMemo(() => {
    const map = new Map<string, PublicQuestion>();
    for (const s of sections) {
      for (const q of s.questions ?? []) map.set(q.id, q);
    }
    return map;
  }, [sections]);

  const sectionsById = useMemo(() => {
    const map = new Map<string, Section>();
    for (const s of sections) map.set(s.id, s);
    return map;
  }, [sections]);

  const totalQuestions = useMemo(() => {
    let n = 0;
    for (const s of sections) {
      for (const q of s.questions ?? []) {
        if (q.type !== "intro") n++;
      }
    }
    if (closingEnabled) n++;
    return n;
  }, [sections, closingEnabled]);

  const estimatedMinutes = useMemo(
    () => estimateSurveyMinutes(sections, closingEnabled),
    [sections, closingEnabled]
  );

  async function handleIdentify() {
    setError(null);
    const trimmedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError(t(locale, "error.emailInvalid"));
      return;
    }

    const res = await fetch(`/api/public/surveys/${shareCode}/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantEmail: trimmedEmail }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? t(locale, "error.startFailed"));
      return;
    }
    setSubmissionId(data.submissionId);
    if (data.resumed && Array.isArray(data.answers) && data.answers.length) {
      hydrateAnswers(data.answers);
      setLastSavedAt(new Date());
      setSaveState("saved");
    }
    setDirection(1);
    setStep((s) => s + 1);
  }

  function validateScreen(screen: Screen): boolean {
    if (screen.kind !== "question") {
      setError(null);
      return true;
    }
    const q = questionsById.get(screen.questionId);
    if (!q) return true;
    if (q.type === "intro") {
      setError(null);
      return true;
    }

    // Top 3 is all-or-nothing regardless of `required`: a partial top 3 is
    // never a valid answer. `required=false` only permits the all-empty case.
    if (isTop3Type(q.type)) {
      const state = rankingState[q.id];
      const filled =
        state?.kind === "top3" ? state.ranked.filter((id) => id !== null).length : 0;
      if (filled === 0 && q.required === false) {
        setError(null);
        return true;
      }
      if (filled !== TOP3_RANK_LENGTH) {
        setError(t(locale, "error.requiredRanking"));
        return false;
      }
      setError(null);
      return true;
    }

    if (q.required === false) {
      setError(null);
      return true;
    }
    if (q.type === "open-text") {
      const text = (openTexts[q.id] ?? "").trim();
      if (!text) {
        setError(t(locale, "error.requiredAny"));
        return false;
      }
    } else if (q.type === "multiple-choice") {
      const sel = choices[q.id] ?? [];
      if (sel.length === 0) {
        setError(t(locale, "error.requiredAny"));
        return false;
      }
    } else if (isFullRankingType(q.type)) {
      // Ranking initialises with a complete shuffled order; if the state is
      // missing for some reason, treat it as unanswered.
      const state = rankingState[q.id];
      if (!state || state.kind !== "rank-all" || state.order.length === 0) {
        setError(t(locale, "error.requiredRanking"));
        return false;
      }
    }
    setError(null);
    return true;
  }

  function isLastAnswerScreen(): boolean {
    // The screen after the current one is `done` (no closing follows).
    const next = screens[step + 1];
    return next?.kind === "done";
  }

  function goNext() {
    if (current.kind === "identity") {
      if (!submissionId) {
        void handleIdentify();
        return;
      }
      setDirection(1);
      setStep((s) => s + 1);
      return;
    }
    if (!validateScreen(current)) return;
    // Final question or closing → confirm before submit
    if (isLastAnswerScreen()) {
      setShowConfirm(true);
      return;
    }
    autosave();
    setDirection(1);
    setStep((s) => s + 1);
  }

  function goPrev() {
    if (step === 0) return;
    setError(null);
    autosave();
    setDirection(-1);
    setStep((s) => s - 1);
  }

  function handleRankingCommit(questionId: string) {
    return (next: RankingState) => {
      setRankingState((prev) => ({ ...prev, [questionId]: next }));
      markDirty();
    };
  }

  function toggleChoice(questionId: string, choiceId: string, mode: "single" | "multi") {
    setChoices((prev) => {
      const current = prev[questionId] ?? [];
      if (mode === "single") return { ...prev, [questionId]: [choiceId] };
      return {
        ...prev,
        [questionId]: current.includes(choiceId)
          ? current.filter((c) => c !== choiceId)
          : [...current, choiceId],
      };
    });
    markDirty();
  }

  const buildAnswers = useCallback((): Array<Record<string, unknown>> => {
    const answers: Array<Record<string, unknown>> = [];
    for (const s of sections) {
      for (const q of s.questions ?? []) {
        switch (q.type) {
          case "intro":
            continue;
          case "archetype-ranking":
          case "general-ranking": {
            const state = rankingState[q.id];
            if (!state || state.kind !== "rank-all") continue;
            const rankings: Record<string, number> = {};
            state.order.forEach((id, i) => {
              rankings[id] = i + 1;
            });
            answers.push({ questionId: q.id, type: q.type, rankings });
            break;
          }
          case "archetype-top3":
          case "general-top3": {
            const state = rankingState[q.id];
            if (!state || state.kind !== "top3") continue;
            const rankings: Record<string, number> = {};
            state.ranked.forEach((id, i) => {
              if (id !== null) rankings[id] = i + 1;
            });
            // Skip empty top-3 answers entirely — the server treats absent
            // answers as "not answered". Partial answers are blocked client-
            // side in validateScreen, so what reaches here is 0 or exactly 3.
            if (Object.keys(rankings).length === 0) break;
            answers.push({ questionId: q.id, type: q.type, rankings });
            break;
          }
          case "multiple-choice": {
            const sel = choices[q.id] ?? [];
            answers.push({ questionId: q.id, type: q.type, selectedChoiceIds: sel });
            break;
          }
          case "open-text": {
            const text = (openTexts[q.id] ?? "").trim();
            if (text || q.required !== false) {
              answers.push({ questionId: q.id, type: q.type, text });
            }
            break;
          }
        }
      }
    }
    return answers;
  }, [sections, rankingState, choices, openTexts]);

  // Fire-and-forget autosave. Called on every step advance/retreat past the
  // identity screen so participants can close the tab and resume later with
  // the same email. Silent: failures aren't surfaced (the final /submit will
  // persist whatever the React state holds anyway).
  const autosave = useCallback(() => {
    if (!submissionId) return;
    const answers = buildAnswers();
    void fetch(`/api/public/surveys/${shareCode}/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissionId, answers }),
    })
      .then((r) => {
        if (r.ok) {
          setLastSavedAt(new Date());
          setSaveState("saved");
        }
      })
      .catch(() => {});
  }, [submissionId, shareCode, buildAnswers]);

  // Inverse of buildAnswers — used to restore saved state when a returning
  // participant identifies with the same email and /start replies with
  // resumed: true + answers[].
  const hydrateAnswers = useCallback(
    (saved: Array<Record<string, unknown>>) => {
      const rankings: Record<string, RankingState> = {};
      const newChoices: Record<string, string[]> = {};
      const newTexts: Record<string, string> = {};

      for (const a of saved) {
        const qid = typeof a.questionId === "string" ? a.questionId : null;
        if (!qid) continue;
        const q = questionsById.get(qid);
        if (!q) continue;
        if (isFullRankingType(q.type)) {
          const allIds = rankingItemIds(q);
          if (allIds.length === 0) continue;
          const ranks = a.rankings as Record<string, number> | undefined;
          if (!ranks || typeof ranks !== "object") continue;
          const ordered = [...allIds].sort(
            (x, y) => (ranks[x] ?? allIds.length + 1) - (ranks[y] ?? allIds.length + 1)
          );
          rankings[qid] = { kind: "rank-all", order: ordered };
        } else if (isTop3Type(q.type)) {
          const allIds = rankingItemIds(q);
          const ranks = a.rankings as Record<string, number> | undefined;
          if (!ranks || typeof ranks !== "object") continue;
          const ranked: (string | null)[] = Array(TOP3_RANK_LENGTH).fill(null);
          for (const [id, r] of Object.entries(ranks)) {
            const n = Number(r);
            if (Number.isFinite(n) && n >= 1 && n <= TOP3_RANK_LENGTH) {
              ranked[n - 1] = id;
            }
          }
          const rankedSet = new Set(ranked.filter((x): x is string => x !== null));
          const pool = fisherYates(allIds.filter((id) => !rankedSet.has(id)));
          rankings[qid] = { kind: "top3", ranked, pool };
        } else if (q.type === "multiple-choice") {
          const sel = Array.isArray(a.selectedChoiceIds)
            ? (a.selectedChoiceIds as string[]).filter((x) => typeof x === "string")
            : [];
          newChoices[qid] = sel;
        } else if (q.type === "open-text") {
          newTexts[qid] = typeof a.text === "string" ? a.text : "";
        }
      }

      if (Object.keys(rankings).length) {
        setRankingState((prev) => ({ ...prev, ...rankings }));
      }
      if (Object.keys(newChoices).length) {
        setChoices((prev) => ({ ...prev, ...newChoices }));
      }
      if (Object.keys(newTexts).length) {
        setOpenTexts((prev) => ({ ...prev, ...newTexts }));
      }
    },
    [questionsById]
  );

  async function handleSubmit() {
    if (!submissionId) {
      setError(t(locale, "error.missingSubmission"));
      return;
    }
    if (current.kind === "question" && !validateScreen(current)) return;
    setError(null);
    setSubmitting(true);

    const answers = buildAnswers();

    const res = await fetch(`/api/public/surveys/${shareCode}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        submissionId,
        answers,
        closingOpenAnswer: closingText.trim() || undefined,
      }),
    });
    setSubmitting(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? t(locale, "error.submitFailed"));
      return;
    }
    setDirection(1);
    setStep(totalSteps - 1);
  }

  if (loading) {
    return (
      <div
        className="min-h-dvh flex items-center justify-center"
        style={{ background: "var(--bg-app)" }}
      >
        <div
          className="w-8 h-8 border-2 rounded-full animate-spin"
          style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }}
        />
      </div>
    );
  }

  if (!survey || survey.status !== "open" || !survey.template) {
    const msgKey =
      survey?.status === "draft"
        ? "error.draft"
        : survey?.status === "closed"
        ? "error.closed"
        : survey?.status === "archived"
        ? "error.archived"
        : "error.invalidLink";
    return (
      <PageShell
        locale={locale}
        onLocaleChange={setLocale}
        clientCompany={survey?.clientCompany}
        primaryColor={survey?.clientPrimaryColor}
      >
        <h1 className="text-2xl font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
          {survey?.title ?? t(locale, "error.notFound")}
        </h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {survey?.message ?? t(locale, msgKey)}
        </p>
      </PageShell>
    );
  }

  const template = survey.template;
  const clientCompany = survey.clientCompany;
  const progress = isDoneStep ? null : step / Math.max(1, totalSteps - 1);
  const primaryLabel = isLastAnswerScreen()
    ? t(locale, "nav.submit")
    : current.kind === "identity"
    ? t(locale, "identify.cta")
    : t(locale, "nav.next");
  const showFooter = !isDoneStep;
  const showPrev = step > 0 && !isDoneStep;
  const currentSectionIntroImg =
    current.kind === "section-intro"
      ? sectionsById.get(current.sectionId)?.imageUrl?.trim() || undefined
      : undefined;
  const motionTransition = reducedMotion
    ? { duration: 0 }
    : { duration: 0.32, ease: [0.22, 1, 0.36, 1] as const };

  function renderScreen(screen: Screen): React.ReactNode {
    if (screen.kind === "identity") {
      return (
        <div className="space-y-8 sm:space-y-10 w-full">
          <div>
            {/* Survey context chip — personalized to client company */}
            <div
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full mb-6"
              style={{
                background: "var(--primary-light)",
                color: "var(--primary)",
              }}
            >
              <MessageCircle size={14} strokeWidth={2.2} />
              <span className="text-[12px] font-semibold uppercase tracking-[0.06em]">
                {clientCompany
                  ? t(locale, "identify.tag", { company: clientCompany })
                  : t(locale, "identify.tagFallback")}
              </span>
            </div>

            {/* Headline — time/day-aware greeting, split into welcome + thanks tiers */}
            <h1
              className="text-[28px] sm:text-[34px] md:text-[42px] font-semibold leading-[1.05]"
              style={{ color: "var(--text-primary)", letterSpacing: "-0.022em" }}
            >
              {greeting.welcome[locale]}
            </h1>
            <p
              className="mt-2 sm:mt-3 text-[18px] sm:text-[22px] md:text-[26px] font-medium leading-[1.2]"
              style={{ color: "var(--text-muted)", letterSpacing: "-0.012em" }}
            >
              {greeting.thanks[locale]}
            </p>

            {/* Body — organizer → anonymity → email rationale */}
            <div
              className="mt-5 max-w-[65ch] space-y-3 text-[16px] sm:text-[18px]"
              style={{ color: "var(--text-muted)", lineHeight: 1.6 }}
            >
              <p>
                {clientCompany
                  ? t(locale, "identify.bodyOrganizer", { company: clientCompany })
                  : t(locale, "identify.bodyOrganizerNoCompany")}
              </p>
              <p>{t(locale, "identify.bodyAnonymous")}</p>
              <p className="text-[14px] sm:text-[15px]">{t(locale, "identify.bodyEmail")}</p>
            </div>

          </div>

          {/* Form */}
          <div className="space-y-5 w-full md:max-w-[50%]">
            <UnderlineField
              label={t(locale, "identify.emailLabel") + " *"}
              type="email"
              value={email}
              onChange={setEmail}
              placeholder={t(locale, "identify.emailPlaceholder")}
              autoFocus
            />
            {totalQuestions > 0 && (
              <p
                className="text-[14px] sm:text-[15px]"
                style={{ color: "var(--text-muted)" }}
              >
                {totalQuestions === 1
                  ? t(locale, "identify.statsLineOne")
                  : t(locale, "identify.statsLine", {
                      n: totalQuestions,
                      min: estimatedMinutes,
                    })}
              </p>
            )}
          </div>
        </div>
      );
    }

    if (screen.kind === "section-intro") {
      const section = sectionsById.get(screen.sectionId);
      if (!section) return null;
      const img = section.imageUrl?.trim();
      return (
        <div className="w-full md:flex md:items-center md:gap-8">
          <div className="flex-1 min-w-0">
            <div className="space-y-7">
              <p className="typo-tag" style={{ color: "var(--primary)" }}>
                {t(locale, "nav.section", { n: screen.sectionIndex + 1, total: screen.totalSections })}
              </p>
              <h2
                className="text-[28px] sm:text-[32px] md:text-[36px] font-semibold leading-[1.15]"
                style={{ color: "var(--text-primary)", letterSpacing: "-0.018em" }}
              >
                {section.title}
              </h2>
              {section.description && (
                <div
                  className="prose prose-sm max-w-[65ch] text-[16px] sm:text-[17px] survey-richtext"
                  style={{ color: "var(--text-muted)", lineHeight: 1.55 }}
                  dangerouslySetInnerHTML={{ __html: section.description }}
                />
              )}
            </div>
            {img && showFooter && (
              <div className="hidden sm:block mt-8">
                <ActionFooter
                  locale={locale}
                  submitting={submitting}
                  error={error}
                  errorToken={errorToken}
                  reducedMotion={!!reducedMotion}
                  onPrev={showPrev ? goPrev : undefined}
                  onPrimary={goNext}
                  primaryLabel={primaryLabel}
                  primaryBusy={submitting && isLastAnswerScreen()}
                />
              </div>
            )}
          </div>
          {img && (
            <div className="md:hidden mt-7 w-full aspect-square rounded-card overflow-hidden">
              <img src={img} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          {img && (
            <div className="hidden md:block shrink-0 w-[45vw] md:max-w-[min(50%,100vh)] h-[90vh] md:max-h-[calc(100vh-260px)] rounded-card overflow-hidden">
              <img src={img} alt="" className="w-full h-full object-cover" />
            </div>
          )}
        </div>
      );
    }

    if (screen.kind === "question") {
      const q = questionsById.get(screen.questionId);
      const section = sectionsById.get(screen.sectionId);
      if (!q || !section) return null;

      if (q.type === "intro") {
        return (
          <div className="space-y-5 w-full">
            <p
              className="text-[15px] sm:text-[16px] font-semibold"
              style={{ color: "var(--primary)", letterSpacing: "-0.005em" }}
            >
              {section.title}
            </p>
            {q.title && (
              <h3
                className="text-[24px] sm:text-[28px] md:text-[30px] font-semibold leading-[1.2]"
                style={{ color: "var(--text-primary)", letterSpacing: "-0.015em" }}
              >
                {q.title}
              </h3>
            )}
            <div
              className="prose prose-sm max-w-[65ch] survey-info survey-richtext"
              style={{ color: "var(--text-primary)" }}
            >
              {q.bodyHtml ? (
                <div dangerouslySetInnerHTML={{ __html: q.bodyHtml }} />
              ) : (
                <p className="text-sm italic" style={{ color: "var(--text-muted)" }}>
                  (no content)
                </p>
              )}
              <style jsx>{`
                .survey-info :global(p) {
                  font-size: 16px;
                  line-height: 1.65;
                  color: var(--text-primary);
                  margin: 0 0 0.75em;
                }
                .survey-info :global(a) {
                  color: var(--primary);
                  border-bottom: 1px solid color-mix(in srgb, currentColor 30%, transparent);
                  transition: border-color 160ms ease-out;
                }
                .survey-info :global(a:hover) {
                  border-bottom-color: currentColor;
                }
                .survey-info :global(ul),
                .survey-info :global(ol) {
                  padding-left: 1.25rem;
                  margin: 0.5em 0;
                }
                .survey-info :global(li) {
                  margin: 0.2em 0;
                }
              `}</style>
            </div>
          </div>
        );
      }

      return (
        <div className="space-y-8 w-full">
          <div>
            <p
              className="text-[15px] sm:text-[16px] font-semibold mb-2"
              style={{ color: "var(--primary)", letterSpacing: "-0.005em" }}
            >
              {section.title}
              <span
                className="ml-2 font-normal"
                style={{ color: "var(--text-muted)" }}
              >
                · {t(locale, "nav.question", { n: screen.qIndexInSection + 1, total: screen.qTotalInSection })}
              </span>
            </p>
            <h2
              className="text-[24px] sm:text-[28px] md:text-[30px] font-semibold leading-[1.2]"
              style={{ color: "var(--text-primary)", letterSpacing: "-0.015em" }}
            >
              {q.title}
            </h2>
            {q.description && (
              <p
                className="mt-3 text-[15px] sm:text-[16px] max-w-[65ch]"
                style={{ color: "var(--text-muted)", lineHeight: 1.55 }}
              >
                {q.description}
              </p>
            )}
          </div>
          <div className="w-full md:max-w-[50%]">
            {isFullRankingType(q.type) && (
              <RankAllInput
                q={q}
                locale={locale}
                sensors={sensors}
                state={rankingState[q.id]}
                labels={rankingLabels[q.id] ?? {}}
                onCommit={handleRankingCommit(q.id)}
              />
            )}
            {isTop3Type(q.type) && (
              <RankingInput
                q={q}
                locale={locale}
                sensors={sensors}
                state={rankingState[q.id]}
                labels={rankingLabels[q.id] ?? {}}
                onCommit={handleRankingCommit(q.id)}
              />
            )}
            {q.type === "multiple-choice" && (
              <MultipleChoiceInput
                q={q}
                locale={locale}
                selected={choices[q.id] ?? []}
                onToggle={(cid) => toggleChoice(q.id, cid, q.choiceMode ?? "single")}
              />
            )}
            {q.type === "open-text" && (
              <OpenTextInput
                q={q}
                value={openTexts[q.id] ?? ""}
                onChange={(v) => {
                  setOpenTexts((p) => ({ ...p, [q.id]: v }));
                  markDirty();
                }}
              />
            )}
          </div>
        </div>
      );
    }

    if (screen.kind === "closing" && template.closingOpenQuestion) {
      return (
        <div className="space-y-6 sm:space-y-8 w-full">
          <div>
            <p className="typo-tag" style={{ color: "var(--primary)" }}>
              {t(locale, "nav.finalQuestion")}
            </p>
            <h2
              className="mt-2 text-[24px] sm:text-[28px] md:text-[30px] font-semibold leading-[1.2]"
              style={{ color: "var(--text-primary)", letterSpacing: "-0.015em" }}
            >
              {template.closingOpenQuestion.label || t(locale, "closing.fallbackLabel")}
            </h2>
          </div>
          <div className="w-full md:max-w-[50%]">
            <UnderlineTextarea
              value={closingText}
              onChange={(v) => {
                setClosingText(v);
                markDirty();
              }}
              placeholder={t(locale, "closing.placeholder")}
              rows={5}
            />
          </div>
        </div>
      );
    }

    if (screen.kind === "done") {
      return <DoneState locale={locale} participantFirstName="" />;
    }

    return null;
  }

  return (
    <PageShell
      locale={locale}
      onLocaleChange={setLocale}
      title={survey.title}
      description={survey.description}
      clientCompany={survey.clientCompany}
      primaryColor={survey.clientPrimaryColor}
      progress={progress}
      savedAt={lastSavedAt}
      saveState={saveState}
      footer={
        showFooter ? (
          <ActionFooter
            locale={locale}
            submitting={submitting}
            error={error}
            errorToken={errorToken}
            reducedMotion={!!reducedMotion}
            onPrev={showPrev ? goPrev : undefined}
            onPrimary={goNext}
            primaryLabel={primaryLabel}
            primaryBusy={submitting && isLastAnswerScreen()}
          />
        ) : null
      }
      hideDesktopFooter={!!currentSectionIntroImg}
    >
      <AnimatePresence mode="wait" initial={false} custom={direction}>
        <motion.div
          key={step}
          custom={direction}
          variants={screenVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={motionTransition}
        >
          {renderScreen(current)}
        </motion.div>
      </AnimatePresence>
      <ConfirmSubmitModal
        open={showConfirm}
        locale={locale}
        submitting={submitting}
        reducedMotion={!!reducedMotion}
        onCancel={() => setShowConfirm(false)}
        onConfirm={() => {
          setShowConfirm(false);
          void handleSubmit();
        }}
      />
    </PageShell>
  );
}

// ── Page shell ──────────────────────────────────────────────────────

function PageShell({
  locale,
  onLocaleChange,
  title,
  description,
  clientCompany,
  primaryColor,
  progress,
  savedAt,
  saveState,
  footer,
  hideDesktopFooter,
  children,
}: {
  locale: Locale;
  onLocaleChange: (l: Locale) => void;
  title?: string;
  description?: string;
  clientCompany?: string;
  primaryColor?: string;
  progress?: number | null;
  savedAt?: Date | null;
  saveState?: "saved" | "unsaved" | null;
  footer?: React.ReactNode;
  hideDesktopFooter?: boolean;
  children: React.ReactNode;
}) {
  const themeStyle: React.CSSProperties = primaryColor
    ? ({
        background: "var(--bg-app)",
        ["--primary" as string]: primaryColor,
        ["--primary-light" as string]: `color-mix(in srgb, ${primaryColor} 15%, white)`,
        ["--focus-ring" as string]: `0 0 0 3px color-mix(in srgb, ${primaryColor} 25%, transparent)`,
      } as React.CSSProperties)
    : { background: "var(--bg-app)" };
  return (
    <div
      className="min-h-dvh flex flex-col"
      style={themeStyle}
    >
      {/* Sticky header: full-width progress + title row with locale switcher */}
      <header
        className="sticky top-0 z-30 border-b"
        style={{
          background: "color-mix(in srgb, var(--bg-surface) 92%, transparent)",
          borderColor: "var(--border)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
        }}
      >
        {/* Full-width progress bar */}
        {progress !== null && progress !== undefined && (
          <div
            className="absolute top-0 left-0 right-0 h-[3px]"
            style={{ background: "var(--bg-hover)" }}
            aria-hidden="true"
          >
            <div
              className="h-full"
              style={{
                width: `${Math.max(2, progress * 100)}%`,
                background: "var(--primary)",
                transition: "width 600ms cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            />
          </div>

          )}
        <div className="flex items-center gap-3 px-6 md:px-[60px] lg:px-[120px] py-3.5">
          <div className="min-w-0 flex-1">
            {title && (
              <h1
                className="text-[15px] sm:text-[16px] font-semibold truncate"
                style={{ color: "var(--text-primary)", letterSpacing: "-0.005em" }}
              >
                {title}
              </h1>
            )}
            {(clientCompany || description) && (
              <p
                className="text-[12px] sm:text-[13px] truncate"
                style={{ color: "var(--text-muted)" }}
              >
                {clientCompany}
                {clientCompany && description ? " · " : null}
                {description}
              </p>
            )}
          </div>
          <AnimatePresence mode="wait" initial={false}>
            {saveState === "saved" && savedAt && (
              <motion.div
                key={`saved-${savedAt.getTime()}`}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                className="hidden sm:flex items-center gap-1 text-[12px]"
                style={{ color: "var(--text-muted)" }}
                aria-live="polite"
              >
                <Check size={12} strokeWidth={2.5} />
                <span>{t(locale, "header.saved")}</span>
              </motion.div>
            )}
            {saveState === "unsaved" && (
              <motion.div
                key="unsaved"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                className="hidden sm:flex items-center gap-1.5 text-[12px]"
                style={{ color: "var(--text-muted)" }}
                aria-live="polite"
              >
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full"
                  style={{ background: "var(--warning)" }}
                  aria-hidden="true"
                />
                <span>{t(locale, "header.unsaved")}</span>
              </motion.div>
            )}
          </AnimatePresence>
          <LocaleSwitcher locale={locale} onChange={onLocaleChange} />
        </div>
      </header>

      <main className="flex-1 flex flex-col w-full px-6 md:px-[60px] lg:px-[120px] py-8 sm:py-12 md:py-16 pb-[140px] sm:pb-[120px]">
        <div className="w-full">
          {children}
          {/* Desktop footer slot — below content */}
          {footer && !hideDesktopFooter && (
            <div className="hidden sm:block">
              {footer}
            </div>
          )}
        </div>
      </main>

      {/* SUMM logo — fixed at the bottom of the viewport. Clears mobile sticky footer (~80px).
          Negative z-index so the form content can scroll over it on small screens. */}
      <div
        className="fixed left-1/2 -translate-x-1/2 -z-10 opacity-30 pointer-events-none bottom-[calc(env(safe-area-inset-bottom)+80px)] sm:bottom-6"
        aria-hidden="true"
      >
        <SummLogoMark />
      </div>

      {/* Mobile sticky footer slot — pinned bottom */}
      {footer && (
        <div className="sm:hidden fixed bottom-0 left-0 right-0 z-20" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          <div
            className="border-t backdrop-blur-md px-6 py-3"
            style={{
              borderColor: "var(--border)",
              background: "color-mix(in srgb, var(--bg-surface) 88%, transparent)",
            }}
          >
            {footer}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Action footer ──────────────────────────────────────────────────

function ActionFooter({
  locale,
  submitting,
  error,
  errorToken,
  reducedMotion,
  onPrev,
  onPrimary,
  primaryLabel,
  primaryBusy,
}: {
  locale: Locale;
  submitting: boolean;
  error?: string | null;
  errorToken: number;
  reducedMotion: boolean;
  onPrev?: () => void;
  onPrimary: () => void;
  primaryLabel: string;
  primaryBusy?: boolean;
}) {
  const label = primaryBusy ? t(locale, "nav.submitting") : primaryLabel;
  const toastTransition = reducedMotion
    ? { duration: 0 }
    : { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const };
  return (
    <div className="sm:mt-10 relative">
      <AnimatePresence>
        {error && (
          <motion.div
            key={errorToken}
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 0, opacity: 0 }}
            transition={toastTransition}
            className="absolute left-0 right-0 -top-3 -translate-y-full pointer-events-none"
          >
            <div className="pointer-events-auto">
              <ErrorToast message={error} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex gap-3">
        {onPrev && (
          <button
            onClick={onPrev}
            className="btn-ghost rounded-button max-sm:flex-1 sm:px-5 py-3 text-sm font-medium"
          >
            {t(locale, "nav.previous")}
          </button>
        )}
        <button
          onClick={onPrimary}
          disabled={submitting}
          className="btn-primary rounded-button max-sm:flex-1 sm:px-5 py-3 text-sm font-semibold inline-flex items-center justify-center gap-2 group disabled:opacity-60"
        >
          {label}
          <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </div>
  );
}

function ErrorToast({ message }: { message: string }) {
  return (
    <div
      className="p-3 rounded-button text-sm"
      style={{ background: "var(--danger-light)", color: "var(--danger)" }}
      role="alert"
    >
      {message}
    </div>
  );
}

// ── Confirm submit modal ─────────────────────────────────────────

function ConfirmSubmitModal({
  open,
  locale,
  submitting,
  reducedMotion,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  locale: Locale;
  submitting: boolean;
  reducedMotion: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, submitting, onCancel]);

  const transition = reducedMotion
    ? { duration: 0 }
    : { duration: 0.22, ease: [0.22, 1, 0.36, 1] as const };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center px-6 py-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={transition}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
        >
          <button
            type="button"
            aria-label="Close"
            onClick={() => { if (!submitting) onCancel(); }}
            className="absolute inset-0 cursor-default"
            style={{ background: "color-mix(in srgb, var(--text-primary) 40%, transparent)", backdropFilter: "blur(2px)" }}
          />
          <motion.div
            initial={{ y: 16, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 8, opacity: 0, scale: 0.98 }}
            transition={transition}
            className="relative w-full max-w-md rounded-card p-6 sm:p-7 shadow-card"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
          >
            <h3
              id="confirm-title"
              className="text-[20px] sm:text-[22px] font-semibold leading-[1.25]"
              style={{ color: "var(--text-primary)", letterSpacing: "-0.015em" }}
            >
              {t(locale, "confirm.title")}
            </h3>
            <p className="mt-2 text-[15px]" style={{ color: "var(--text-muted)", lineHeight: 1.55 }}>
              {t(locale, "confirm.description")}
            </p>
            <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
              <button
                onClick={onCancel}
                disabled={submitting}
                className="btn-ghost rounded-button px-5 py-3 text-sm font-medium disabled:opacity-60"
              >
                {t(locale, "confirm.cancel")}
              </button>
              <button
                onClick={onConfirm}
                disabled={submitting}
                className="btn-primary rounded-button px-5 py-3 text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {submitting ? t(locale, "nav.submitting") : t(locale, "confirm.confirm")}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Per-question renderer ────────────────────────────────────────

function RankingInput({
  q,
  locale,
  sensors,
  state,
  labels,
  onCommit,
}: {
  q: PublicQuestion;
  locale: Locale;
  sensors: ReturnType<typeof useSensors>;
  state: RankingState | undefined;
  labels: Record<string, string>;
  onCommit: (next: RankingState) => void;
}) {
  const items = useMemo(
    () =>
      q.type === "archetype-top3"
        ? q.options ?? []
        : q.rankingItems ?? [],
    [q.type, q.options, q.rankingItems]
  );
  const itemMap = useMemo(
    () => new Map(items.map((i) => [i.id, i] as const)),
    [items]
  );
  const slotCount = TOP3_RANK_LENGTH;
  const fallback: Top3State = useMemo(
    () => ({
      kind: "top3",
      ranked: Array(slotCount).fill(null),
      pool: items.map((i) => i.id),
    }),
    [items, slotCount]
  );
  const current: Top3State = state && state.kind === "top3" ? state : fallback;
  const placed = current.ranked.filter((id) => id !== null).length;
  const remaining = slotCount - placed;
  const allPlaced = remaining === 0;

  const [activeDrag, setActiveDrag] = useState<{
    id: string;
    zone: "slot" | "pool";
    rank?: number;
  } | null>(null);
  const [activeOverId, setActiveOverId] = useState<string | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    const zone = event.active.data.current?.zone as "slot" | "pool" | undefined;
    if (!zone) return;
    const id = String(event.active.id);
    const slotIdx = current.ranked.indexOf(id);
    setActiveDrag({ id, zone, rank: slotIdx >= 0 ? slotIdx + 1 : undefined });
    setActiveOverId(null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    setActiveOverId(event.over ? String(event.over.id) : null);
  };

  const handleDragEnd = () => {
    // Commit whatever the user sees in the preview. Using `previewState` here is
    // more robust than re-deriving from `event.over.id`, which can be stale once
    // the preview has shifted DOM positions around during the drag.
    if (previewState !== current) {
      onCommit(previewState);
    }
    setActiveDrag(null);
    setActiveOverId(null);
  };

  const handleDragCancel = () => {
    setActiveDrag(null);
    setActiveOverId(null);
  };

  // Live preview during drag: while the user hovers a target, compute what the
  // state would look like on drop and render that. Cascades become visible
  // before commit, so users see exactly where the chosen card will land.
  const previewState: Top3State =
    activeDrag && activeOverId
      ? computeNextTop3(current, activeDrag.id, activeDrag.zone, activeOverId, q.id)
      : current;

  const activeItem = activeDrag ? itemMap.get(activeDrag.id) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="mb-4">
        <p
          className="text-[15px] font-medium"
          style={{ color: "var(--text-primary)", lineHeight: 1.4 }}
        >
          {t(locale, "ranking.helperBold")}
        </p>
        <p
          className="text-[14px] mt-1"
          style={{ color: "var(--text-muted)", lineHeight: 1.5 }}
        >
          {t(locale, "ranking.helperRest")}
        </p>
      </div>
      <LayoutGroup id={`ranking-${q.id}`}>
        <RankingSlots
          qid={q.id}
          ranked={previewState.ranked}
          itemMap={itemMap}
          labels={labels}
          locale={locale}
          activeDragId={activeDrag?.id ?? null}
          previewTargetIdx={
            activeDrag && activeOverId
              ? previewState.ranked.indexOf(activeDrag.id)
              : -1
          }
        />
        <div
          className="mt-4 mb-2 flex items-center gap-2 text-[13px]"
          style={{ color: allPlaced ? "var(--success)" : "var(--text-muted)" }}
        >
          {allPlaced ? (
            <>
              <Check size={14} strokeWidth={2.4} />
              <span>{t(locale, "ranking.allPlaced")}</span>
            </>
          ) : (
            <span>
              {t(locale, "ranking.poolRemaining", { n: remaining, total: slotCount })}
            </span>
          )}
        </div>
        <RankingPool
          qid={q.id}
          pool={previewState.pool}
          itemMap={itemMap}
          labels={labels}
          locale={locale}
          allPlaced={previewState.ranked.every((id) => id !== null)}
          activeDragId={activeDrag?.id ?? null}
        />
      </LayoutGroup>
      <DragOverlay dropAnimation={null}>
        {activeDrag && activeItem ? (
          <DragOverlayItem
            zone={activeDrag.zone}
            rank={activeDrag.rank}
            label={labels[activeDrag.id]}
            text={activeItem.text || "(no text)"}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

// ── Rank-all input (single sortable list, no pool) ────────────────

function RankAllInput({
  q,
  locale,
  sensors,
  state,
  labels,
  onCommit,
}: {
  q: PublicQuestion;
  locale: Locale;
  sensors: ReturnType<typeof useSensors>;
  state: RankingState | undefined;
  labels: Record<string, string>;
  onCommit: (next: RankingState) => void;
}) {
  const items = useMemo(
    () =>
      q.type === "archetype-ranking"
        ? q.options ?? []
        : q.rankingItems ?? [],
    [q.type, q.options, q.rankingItems]
  );
  const itemMap = useMemo(
    () => new Map(items.map((i) => [i.id, i] as const)),
    [items]
  );
  // Fallback uses items in their authored order. The real initial state set
  // by the page-load effect is shuffled — the fallback only matters if state
  // is somehow missing mid-render.
  const fallback: RankAllState = useMemo(
    () => ({ kind: "rank-all", order: items.map((i) => i.id) }),
    [items]
  );
  const current: RankAllState = state && state.kind === "rank-all" ? state : fallback;
  const [activeId, setActiveId] = useState<string | null>(null);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;
    const from = current.order.indexOf(String(active.id));
    const to = current.order.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    onCommit({ kind: "rank-all", order: arrayMove(current.order, from, to) });
  };

  const activeItem = activeId ? itemMap.get(activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={(e) => setActiveId(String(e.active.id))}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="mb-4">
        <p
          className="text-[15px] font-medium"
          style={{ color: "var(--text-primary)", lineHeight: 1.4 }}
        >
          {t(locale, "ranking.helperBold")}
        </p>
        <p
          className="text-[14px] mt-1"
          style={{ color: "var(--text-muted)", lineHeight: 1.5 }}
        >
          {t(locale, "ranking.helperRest")}
        </p>
      </div>
      <SortableContext items={current.order} strategy={verticalListSortingStrategy}>
        <div className="space-y-1.5">
          {current.order.map((id, idx) => {
            const item = itemMap.get(id);
            if (!item) return null;
            return (
              <SortableRankAllItem
                key={id}
                id={id}
                rank={idx + 1}
                label={labels[id]}
                text={item.text || "(no text)"}
                hidden={activeId === id}
              />
            );
          })}
        </div>
      </SortableContext>
      <DragOverlay dropAnimation={null}>
        {activeId && activeItem ? (
          <PreviewSlotItem
            rank={current.order.indexOf(activeId) + 1}
            label={labels[activeId]}
            text={activeItem.text || "(no text)"}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function SortableRankAllItem({
  id,
  rank,
  label,
  text,
  hidden,
}: {
  id: string;
  rank: number;
  label?: string;
  text: string;
  hidden: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: hidden || isDragging ? 0 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="rounded-card border min-h-[56px] sm:min-h-[64px] cursor-grab active:cursor-grabbing"
    >
      <div
        className="flex items-center gap-3 pl-2 pr-4 py-3 sm:py-3.5 rounded-card min-h-[56px] sm:min-h-[64px] select-none"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
        }}
      >
        <GripVertical
          size={16}
          style={{ color: "var(--text-muted)" }}
          className="shrink-0 opacity-60"
        />
        <span
          className="w-8 h-8 rounded-full flex items-center justify-center text-[14px] tabular-nums font-bold shrink-0"
          style={rankChipStyle(rank, true)}
        >
          {rank}
        </span>
        {label && (
          <span
            className="text-[13px] font-semibold tabular-nums shrink-0"
            style={{ color: "var(--text-muted)" }}
            aria-hidden="true"
          >
            {label}
          </span>
        )}
        <span
          className="text-[15px] flex-1 min-w-0"
          style={{ color: "var(--text-primary)", lineHeight: 1.4 }}
        >
          {text}
        </span>
      </div>
    </div>
  );
}

function rankChipStyle(rank: number, filled: boolean): React.CSSProperties {
  if (!filled) {
    return {
      background: "transparent",
      color: "var(--text-muted)",
      border: "1.5px dashed var(--border)",
    };
  }
  if (rank === 1) {
    return { background: "var(--primary)", color: "#fff" };
  }
  return { background: "var(--primary-light)", color: "var(--primary)" };
}

function RankingSlots({
  qid,
  ranked,
  itemMap,
  labels,
  locale,
  activeDragId,
  previewTargetIdx,
}: {
  qid: string;
  ranked: (string | null)[];
  itemMap: Map<string, { id: string; text: string }>;
  labels: Record<string, string>;
  locale: Locale;
  activeDragId: string | null;
  previewTargetIdx: number;
}) {
  return (
    <div className="space-y-1.5">
      {ranked.map((itemId, idx) => {
        const validId =
          itemId !== null && itemMap.has(itemId) ? itemId : null;
        const isPreviewActive = previewTargetIdx >= 0;
        const isPreviewTarget = idx === previewTargetIdx;

        // Target slot of the live preview: render a non-draggable ghost
        // (using the dragged item's text), so the user sees exactly where the
        // card would land. Using a non-draggable means no `useDraggable`
        // isDragging=true → opacity:0 bug.
        if (isPreviewTarget && activeDragId !== null) {
          const text = itemMap.get(activeDragId)?.text || "(no text)";
          return (
            <SlotCell
              key={idx}
              qid={qid}
              index={idx}
              rank={idx + 1}
              locale={locale}
              isEmpty={false}
              isPreviewTarget
            >
              <PreviewSlotItem
                rank={idx + 1}
                label={labels[activeDragId]}
                text={text}
              />
            </SlotCell>
          );
        }

        // Without an active preview target, treat the source slot of the
        // current drag as empty (the item is shown by DragOverlay instead).
        const isSourceWithoutPreview =
          !isPreviewActive && validId !== null && validId === activeDragId;
        const isEmpty = validId === null || isSourceWithoutPreview;
        return (
          <SlotCell
            key={idx}
            qid={qid}
            index={idx}
            rank={idx + 1}
            locale={locale}
            isEmpty={isEmpty}
            isPreviewTarget={false}
          >
            {!isEmpty && validId !== null && (
              <DraggableRankItem
                id={validId}
                zone="slot"
                index={idx}
                rank={idx + 1}
                label={labels[validId]}
                text={itemMap.get(validId)?.text || "(no text)"}
              />
            )}
          </SlotCell>
        );
      })}
    </div>
  );
}

function PreviewSlotItem({
  rank,
  label,
  text,
}: {
  rank: number;
  label?: string;
  text: string;
}) {
  return (
    <div
      className="flex items-center gap-3 pl-2 pr-4 py-3 sm:py-3.5 rounded-card min-h-[56px] sm:min-h-[64px] select-none"
      style={{ background: "var(--bg-surface)", opacity: 0.55 }}
    >
      <GripVertical
        size={16}
        style={{ color: "var(--text-muted)" }}
        className="shrink-0 opacity-60"
      />
      <span
        className="w-8 h-8 rounded-full flex items-center justify-center text-[14px] tabular-nums font-bold shrink-0"
        style={rankChipStyle(rank, true)}
      >
        {rank}
      </span>
      {label && (
        <span
          className="text-[13px] font-semibold tabular-nums shrink-0"
          style={{ color: "var(--text-muted)" }}
          aria-hidden="true"
        >
          {label}
        </span>
      )}
      <span
        className="text-[15px] flex-1 min-w-0"
        style={{ color: "var(--text-primary)", lineHeight: 1.4 }}
      >
        {text}
      </span>
    </div>
  );
}

function SlotCell({
  qid,
  index,
  rank,
  locale,
  isEmpty,
  isPreviewTarget,
  children,
}: {
  qid: string;
  index: number;
  rank: number;
  locale: Locale;
  isEmpty: boolean;
  isPreviewTarget: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: slotDroppableId(qid, index),
    data: { zone: "slot", index },
  });
  const highlight = isOver || isPreviewTarget;
  return (
    <div
      ref={setNodeRef}
      className="rounded-card border min-h-[56px] sm:min-h-[64px] transition-colors"
      style={{
        borderStyle: isEmpty ? "dashed" : "solid",
        borderWidth: isEmpty ? 1.5 : 1,
        borderColor: highlight ? "var(--primary)" : "var(--border)",
        background: highlight
          ? "var(--primary-light)"
          : isEmpty
          ? "var(--bg-app)"
          : "var(--bg-surface)",
      }}
    >
      {isEmpty ? (
        <div className="flex items-center gap-3 pl-2 pr-4 py-3 sm:py-3.5 min-h-[56px] sm:min-h-[64px]">
          <span className="w-4 shrink-0" aria-hidden="true" />
          <span
            className="w-8 h-8 rounded-full flex items-center justify-center text-[14px] tabular-nums font-bold shrink-0"
            style={
              isPreviewTarget
                ? rankChipStyle(rank, true)
                : rankChipStyle(rank, false)
            }
          >
            {rank}
          </span>
          <span
            className="text-[14px] flex-1 min-w-0 italic"
            style={{
              color: isPreviewTarget ? "var(--primary)" : "var(--text-muted)",
              lineHeight: 1.4,
            }}
          >
            {t(locale, "ranking.emptySlotHint", { n: rank })}
          </span>
        </div>
      ) : (
        children
      )}
    </div>
  );
}

function DraggableRankItem({
  id,
  zone,
  index,
  rank,
  label,
  text,
}: {
  id: string;
  zone: "slot" | "pool";
  index?: number;
  rank?: number;
  label?: string;
  text: string;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data: { zone, index },
  });
  return (
    <motion.div
      ref={setNodeRef}
      layout
      layoutId={`rank-item-${id}`}
      transition={{ type: "spring", stiffness: 260, damping: 28, mass: 0.9 }}
      style={{
        opacity: isDragging ? 0 : 1,
        background: zone === "slot" ? "var(--bg-surface)" : "var(--bg-elevated)",
      }}
      {...attributes}
      {...listeners}
      className="flex items-center gap-3 pl-2 pr-4 py-3 sm:py-3.5 rounded-card cursor-grab active:cursor-grabbing touch-none min-h-[56px] sm:min-h-[64px] select-none"
    >
      <RankItemBody zone={zone} rank={rank} label={label} text={text} />
    </motion.div>
  );
}

function RankItemBody({
  zone,
  rank,
  label,
  text,
}: {
  zone: "slot" | "pool";
  rank?: number;
  label?: string;
  text: string;
}) {
  return (
    <>
      <GripVertical
        size={16}
        style={{ color: "var(--text-muted)" }}
        className="shrink-0 opacity-60"
      />
      {zone === "slot" && rank !== undefined && (
        <span
          className="w-8 h-8 rounded-full flex items-center justify-center text-[14px] tabular-nums font-bold shrink-0 transition-colors"
          style={rankChipStyle(rank, true)}
        >
          {rank}
        </span>
      )}
      {label && (
        <span
          className="text-[13px] font-semibold tabular-nums shrink-0"
          style={{ color: "var(--text-muted)" }}
          aria-hidden="true"
        >
          {label}
        </span>
      )}
      <span
        className="text-[15px] flex-1 min-w-0"
        style={{ color: "var(--text-primary)", lineHeight: 1.4 }}
      >
        {text}
      </span>
    </>
  );
}

function DragOverlayItem({
  zone,
  rank,
  label,
  text,
}: {
  zone: "slot" | "pool";
  rank?: number;
  label?: string;
  text: string;
}) {
  return (
    <div
      style={{
        background: zone === "slot" ? "var(--bg-surface)" : "var(--bg-elevated)",
        borderColor: "var(--primary)",
        boxShadow:
          "0 16px 32px -8px color-mix(in srgb, var(--primary) 36%, transparent)",
      }}
      className="flex items-center gap-3 pl-2 pr-4 py-3 sm:py-3.5 rounded-card border-2 cursor-grabbing touch-none min-h-[56px] sm:min-h-[64px] select-none"
    >
      <RankItemBody zone={zone} rank={rank} label={label} text={text} />
    </div>
  );
}

function RankingPool({
  qid,
  pool,
  itemMap,
  labels,
  locale,
  allPlaced,
  activeDragId,
}: {
  qid: string;
  pool: string[];
  itemMap: Map<string, { id: string; text: string }>;
  labels: Record<string, string>;
  locale: Locale;
  allPlaced: boolean;
  activeDragId: string | null;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: poolDroppableId(qid),
    data: { zone: "pool" },
  });
  const visiblePool = pool.filter((id) => id !== activeDragId);
  return (
    <div
      ref={setNodeRef}
      className="rounded-card border p-3 transition-colors"
      style={{
        borderColor: isOver
          ? "var(--primary)"
          : allPlaced
          ? "var(--success-light, color-mix(in srgb, var(--success) 35%, transparent))"
          : "var(--border)",
        background: isOver
          ? "var(--primary-light)"
          : allPlaced
          ? "color-mix(in srgb, var(--success) 6%, var(--bg-elevated))"
          : "var(--bg-elevated)",
      }}
    >
      <p
        className="typo-section-header mb-2"
        style={{ color: "var(--text-muted)" }}
      >
        {t(locale, "ranking.poolLabel")}
      </p>
      {visiblePool.length === 0 ? (
        <div
          className="flex items-center justify-center rounded-card border min-h-[56px] sm:min-h-[64px] px-4 py-3 text-[13px] italic"
          style={{
            borderStyle: "dashed",
            borderColor: "var(--border)",
            background: "var(--bg-app)",
            color: "var(--text-muted)",
            lineHeight: 1.4,
          }}
        >
          {t(locale, "ranking.poolEmptyHint")}
        </div>
      ) : (
        <div className="space-y-1.5">
          {visiblePool.map((id) => {
            const item = itemMap.get(id);
            if (!item) return null;
            return (
              <DraggableRankItem
                key={id}
                id={id}
                zone="pool"
                label={labels[id]}
                text={item.text || "(no text)"}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function MultipleChoiceInput({
  q,
  locale,
  selected,
  onToggle,
}: {
  q: PublicQuestion;
  locale: Locale;
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const mode = q.choiceMode ?? "single";
  const choicesList = q.choices ?? [];
  return (
    <div className="space-y-2">
      {choicesList.map((c) => {
        const isSelected = selected.includes(c.id);
        return (
          <label
            key={c.id}
            className="flex items-center gap-3 px-4 py-3 sm:py-3.5 rounded-card border cursor-pointer transition-all min-h-[52px] active:scale-[0.985]"
            style={{
              borderColor: isSelected ? "var(--primary)" : "var(--border)",
              background: isSelected
                ? "color-mix(in srgb, var(--primary) 6%, var(--bg-surface))"
                : "var(--bg-surface)",
              color: "var(--text-primary)",
            }}
          >
            <input
              type={mode === "single" ? "radio" : "checkbox"}
              checked={isSelected}
              onChange={() => onToggle(c.id)}
              name={mode === "single" ? `q-${q.id}` : undefined}
              className="sr-only"
            />
            <span
              className="shrink-0 inline-flex items-center justify-center transition-all"
              style={{
                width: 20,
                height: 20,
                borderRadius: mode === "single" ? "50%" : 5,
                border: `2px solid ${isSelected ? "var(--primary)" : "var(--border)"}`,
                background: isSelected ? "var(--primary)" : "transparent",
              }}
              aria-hidden="true"
            >
              {isSelected && mode === "single" && (
                <span
                  className="block rounded-full"
                  style={{ width: 8, height: 8, background: "#fff" }}
                />
              )}
              {isSelected && mode === "multi" && (
                <Check size={12} strokeWidth={3} color="#fff" />
              )}
            </span>
            <span
              className="text-[15px] flex-1 min-w-0"
              style={{
                fontWeight: isSelected ? 500 : 400,
                lineHeight: 1.4,
              }}
            >
              {c.text || "(no text)"}
            </span>
          </label>
        );
      })}
      {mode === "multi" && q.maxSelections && (
        <p
          className="text-[12px] italic text-right mt-1.5"
          style={{ color: "var(--text-muted)" }}
        >
          {t(locale, "choice.maxHelper", { n: q.maxSelections })}
        </p>
      )}
    </div>
  );
}

function OpenTextInput({
  q,
  value,
  onChange,
}: {
  q: PublicQuestion;
  value: string;
  onChange: (v: string) => void;
}) {
  if (q.multiline) {
    return (
      <UnderlineTextarea
        value={value}
        onChange={onChange}
        placeholder={q.placeholder ?? "Type your answer…"}
      />
    );
  }
  return (
    <UnderlineField
      type="text"
      value={value}
      onChange={onChange}
      placeholder={q.placeholder ?? "Type your answer…"}
    />
  );
}

// ── Filled input primitives ───────────────────────────────────────

function UnderlineField({
  label,
  type,
  value,
  onChange,
  placeholder,
  autoFocus,
}: {
  label?: string;
  type: "text" | "email";
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      {label && (
        <label
          className="block text-[12px] font-medium mb-1.5"
          style={{ color: "var(--text-muted)" }}
        >
          {label}
        </label>
      )}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="w-full outline-none rounded-button"
        style={{
          color: "var(--text-primary)",
          fontSize: 16,
          lineHeight: 1.5,
          padding: "12px 14px",
          background: "var(--bg-surface)",
          border: `1px solid ${focused ? "var(--primary)" : "var(--border)"}`,
          boxShadow: focused ? "var(--focus-ring)" : "none",
          transition: "border-color 180ms ease, box-shadow 180ms ease",
        }}
      />
    </div>
  );
}

function UnderlineTextarea({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      className="w-full outline-none resize-none rounded-button"
      style={{
        color: "var(--text-primary)",
        fontSize: 16,
        lineHeight: 1.55,
        minHeight: 96,
        padding: "12px 14px",
        background: "var(--bg-elevated)",
        border: `1px solid ${focused ? "var(--primary)" : "var(--border)"}`,
        boxShadow: focused ? "var(--focus-ring)" : "none",
        transition: "border-color 180ms ease, box-shadow 180ms ease",
      }}
    />
  );
}

// ── Done state ─────────────────────────────────────────────────────

function DoneState({
  locale,
  participantFirstName,
}: {
  locale: Locale;
  participantFirstName: string;
}) {
  const [confettiSeed] = useState(() => Math.random());

  // Generate 8 confetti particles with deterministic-per-mount randomness
  const particles = useMemo(() => {
    return Array.from({ length: 8 }).map((_, i) => {
      const rand = (offset: number) =>
        Math.sin(confettiSeed * 1000 + i * 17 + offset) * 0.5 + 0.5;
      const angle = rand(1) * 360;
      const distance = 60 + rand(2) * 60; // 60-120px
      const tx = Math.cos((angle * Math.PI) / 180) * distance;
      const ty = -Math.abs(Math.sin((angle * Math.PI) / 180) * distance) - 20;
      const r = (rand(3) - 0.5) * 360;
      const delay = rand(4) * 120;
      const colors = ["var(--primary)", "var(--accent-3)", "var(--accent-6)", "var(--success)"];
      const color = colors[i % colors.length];
      return { tx, ty, r, delay, color, key: i };
    });
  }, [confettiSeed]);

  return (
    <div className="text-center py-8 sm:py-12 relative">
      {/* Confetti overlay */}
      <div
        className="absolute inset-x-0 top-12 flex justify-center pointer-events-none"
        aria-hidden="true"
      >
        <div className="relative">
          {particles.map((p) => (
            <span
              key={p.key}
              className="survey-confetti-particle absolute block rounded-full"
              style={
                {
                  width: 8,
                  height: 8,
                  background: p.color,
                  left: 0,
                  top: 0,
                  ["--confetti-tx" as string]: `${p.tx}px`,
                  ["--confetti-ty" as string]: `${p.ty}px`,
                  ["--confetti-r" as string]: `${p.r}deg`,
                  animation: `survey-confetti-drift 900ms ease-out ${p.delay}ms forwards`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      </div>

      <div
        className="survey-check-icon w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
        style={{
          background: "var(--primary)",
          animation: "survey-check-pop 500ms cubic-bezier(0.34, 1.56, 0.64, 1) both",
        }}
      >
        <Check size={32} strokeWidth={3} color="#fff" />
      </div>
      <h2
        className="text-[24px] sm:text-[28px] font-semibold mb-2"
        style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}
      >
        {participantFirstName
          ? t(locale, "done.headlinePersonal", { name: participantFirstName })
          : t(locale, "done.headline")}
      </h2>
      <p
        className="text-[15px] max-w-[36ch] mx-auto"
        style={{ color: "var(--text-muted)", lineHeight: 1.55 }}
      >
        {t(locale, "done.subline")}
      </p>
    </div>
  );
}
