"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowRight, Check, GripVertical, MessageCircle } from "lucide-react";
import type { SurveyQuestionType } from "@/lib/surveys/types";
import LocaleSwitcher, { type Locale } from "@/components/ui/LocaleSwitcher";
import { t } from "@/lib/surveys/translations";
import { pickGreeting, type Greeting } from "@/lib/surveys/greetings";

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
  if (q.type === "archetype-ranking") return (q.options ?? []).map((o) => o.id);
  if (q.type === "general-ranking") return (q.rankingItems ?? []).map((i) => i.id);
  return [];
}

// Per-question time estimates in seconds. Used to compute the "≈ X minutes"
// label on the welcome screen. Tuned for typical participants — not exact.
function estimateQuestionSeconds(q: PublicQuestion): number {
  switch (q.type) {
    case "intro":
      return 0;
    case "multiple-choice":
      return q.choiceMode === "multi" ? 30 : 20;
    case "archetype-ranking":
      return 15 + (q.options?.length ?? 0) * 6;
    case "general-ranking":
      return 15 + (q.rankingItems?.length ?? 0) * 6;
    case "open-text":
      return q.multiline ? 90 : 40;
    default:
      return 25;
  }
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

  const [questionOrders, setQuestionOrders] = useState<Record<string, string[]>>({});
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
          const init: Record<string, string[]> = {};
          for (const s of data.template.sections) {
            for (const q of s.questions ?? []) {
              const ids = rankingItemIds(q);
              if (ids.length > 0) init[q.id] = fisherYates(ids);
            }
          }
          setQuestionOrders(init);
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

  const estimatedMinutes = useMemo(() => {
    let seconds = 0;
    for (const s of sections) {
      for (const q of s.questions ?? []) {
        seconds += estimateQuestionSeconds(q);
      }
    }
    if (closingEnabled) seconds += 90;
    return Math.max(1, Math.round(seconds / 60));
  }, [sections, closingEnabled]);

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
    if (q.required === false || q.type === "intro") {
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
    setDirection(1);
    setStep((s) => s + 1);
  }

  function goPrev() {
    if (step === 0) return;
    setError(null);
    setDirection(-1);
    setStep((s) => s - 1);
  }

  function handleReorder(questionId: string) {
    return (event: DragEndEvent | DragOverEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      setQuestionOrders((prev) => {
        const list = prev[questionId];
        if (!list) return prev;
        const oldIndex = list.indexOf(active.id as string);
        const newIndex = list.indexOf(over.id as string);
        if (oldIndex < 0 || newIndex < 0) return prev;
        return { ...prev, [questionId]: arrayMove(list, oldIndex, newIndex) };
      });
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
  }

  async function handleSubmit() {
    if (!submissionId) {
      setError(t(locale, "error.missingSubmission"));
      return;
    }
    if (current.kind === "question" && !validateScreen(current)) return;
    setError(null);
    setSubmitting(true);

    const answers: Array<Record<string, unknown>> = [];
    for (const s of sections) {
      for (const q of s.questions ?? []) {
        switch (q.type) {
          case "intro":
            continue;
          case "archetype-ranking":
          case "general-ranking": {
            const order = questionOrders[q.id];
            if (!order) continue;
            answers.push({
              questionId: q.id,
              type: q.type,
              rankings: Object.fromEntries(order.map((id, i) => [id, i + 1])),
            });
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
  const progress = isDoneStep ? null : step / Math.max(1, totalSteps - 1);
  const primaryLabel = isLastAnswerScreen()
    ? t(locale, "nav.submit")
    : current.kind === "identity"
    ? t(locale, "identify.cta")
    : t(locale, "nav.next");
  const showFooter = !isDoneStep;
  const showPrev = step > 0 && !isDoneStep;
  const motionTransition = reducedMotion
    ? { duration: 0 }
    : { duration: 0.32, ease: [0.22, 1, 0.36, 1] as const };

  function renderScreen(screen: Screen): React.ReactNode {
    if (screen.kind === "identity") {
      return (
        <div className="space-y-8 sm:space-y-10 w-full">
          <div>
            {/* Survey context chip */}
            <div
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full mb-6"
              style={{
                background: "var(--primary-light)",
                color: "var(--primary)",
              }}
            >
              <MessageCircle size={14} strokeWidth={2.2} />
              <span className="text-[12px] font-semibold uppercase tracking-[0.06em]">
                {t(locale, "identify.tag")}
              </span>
            </div>

            {/* Headline — time/day-aware greeting, full width, larger for impact */}
            <h2
              className="text-[34px] sm:text-[42px] md:text-[52px] font-semibold leading-[1.05]"
              style={{ color: "var(--text-primary)", letterSpacing: "-0.022em" }}
            >
              {greeting[locale]}
            </h2>

            {/* Subline — constrained for readability */}
            <p
              className="mt-5 max-w-[65ch] text-[16px] sm:text-[18px]"
              style={{ color: "var(--text-muted)", lineHeight: 1.6 }}
            >
              {t(locale, "identify.subline")}
            </p>

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
      return (
        <div className="space-y-7 w-full">
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
            {(q.type === "archetype-ranking" || q.type === "general-ranking") && (
              <RankingInput
                q={q}
                locale={locale}
                sensors={sensors}
                order={questionOrders[q.id]}
                onReorder={handleReorder(q.id)}
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
                onChange={(v) => setOpenTexts((p) => ({ ...p, [q.id]: v }))}
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
              onChange={setClosingText}
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
  footer,
  children,
}: {
  locale: Locale;
  onLocaleChange: (l: Locale) => void;
  title?: string;
  description?: string;
  clientCompany?: string;
  primaryColor?: string;
  progress?: number | null;
  footer?: React.ReactNode;
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
        <div className="flex items-center gap-3 px-6 md:px-[120px] py-3.5">
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
          <LocaleSwitcher locale={locale} onChange={onLocaleChange} />
        </div>
      </header>

      <main className="flex-1 flex flex-col w-full px-6 md:px-[120px] py-8 sm:py-12 md:py-16 pb-[140px] sm:pb-[120px]">
        <div className="w-full">
          {children}
          {/* Desktop footer slot — below content */}
          {footer && (
            <div className="hidden sm:block">
              {footer}
            </div>
          )}
        </div>
      </main>

      {/* SUMM logo — fixed at the bottom of the viewport. Clears mobile sticky footer (~80px). */}
      <div
        className="fixed left-1/2 -translate-x-1/2 z-10 opacity-30 pointer-events-none bottom-[calc(env(safe-area-inset-bottom)+80px)] sm:bottom-6"
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
  order,
  onReorder,
}: {
  q: PublicQuestion;
  locale: Locale;
  sensors: ReturnType<typeof useSensors>;
  order: string[] | undefined;
  onReorder: (e: DragEndEvent | DragOverEvent) => void;
}) {
  const items = q.type === "archetype-ranking" ? q.options ?? [] : q.rankingItems ?? [];
  const computed = order ?? items.map((i) => i.id);
  return (
    <>
      <p
        className="text-[15px] mb-4"
        style={{ color: "var(--text-muted)", lineHeight: 1.5 }}
      >
        <strong className="font-medium" style={{ color: "var(--text-primary)" }}>
          {t(locale, "ranking.helperBold")}
        </strong>{" "}
        {t(locale, "ranking.helperRest")}
      </p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragOver={onReorder} onDragEnd={onReorder}>
        <SortableContext items={computed} strategy={verticalListSortingStrategy}>
          <div className="space-y-1.5">
            {computed.map((id, idx) => {
              const item = items.find((x) => x.id === id);
              if (!item) return null;
              return (
                <SortableOption
                  key={item.id}
                  id={item.id}
                  rank={idx + 1}
                  text={item.text || "(no text)"}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
    </>
  );
}

function rankChipStyle(rank: number): React.CSSProperties {
  if (rank === 1) {
    return { background: "var(--primary)", color: "#fff" };
  }
  return { background: "var(--primary-light)", color: "var(--primary)" };
}

function SortableOption({ id, rank, text }: { id: string; rank: number; text: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const chipStyle = rankChipStyle(rank);
  return (
    <div
      ref={setNodeRef}
      style={{
        // Use dnd-kit's transform straight — no extra scale/rotate (interferes with translate)
        transform: CSS.Transform.toString(transform),
        // Use only dnd-kit's transition value; no fallback that animates during active drag
        transition,
        zIndex: isDragging ? 10 : undefined,
        borderColor: isDragging ? "var(--primary)" : "var(--border)",
        background: "var(--bg-surface)",
        boxShadow: isDragging
          ? "0 12px 28px -8px color-mix(in srgb, var(--primary) 32%, transparent)"
          : "none",
      }}
      {...attributes}
      {...listeners}
      className="flex items-center gap-3 pl-2 pr-4 py-3 sm:py-3.5 rounded-card border cursor-grab active:cursor-grabbing touch-none min-h-[56px] sm:min-h-[64px] select-none"
    >
      <GripVertical
        size={16}
        style={{ color: "var(--text-muted)" }}
        className="shrink-0 opacity-60"
      />
      <span
        className="w-8 h-8 rounded-full flex items-center justify-center text-[14px] tabular-nums font-bold shrink-0 transition-colors"
        style={chipStyle}
      >
        {rank}
      </span>
      <span
        className="text-[15px] flex-1 min-w-0"
        style={{ color: "var(--text-primary)", lineHeight: 1.4 }}
      >
        {text}
      </span>
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
