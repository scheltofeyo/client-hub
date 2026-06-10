"use client";

import { useCallback, useMemo, useState } from "react";

/**
 * Explicit-save editor state, lifted out of the old per-card `DraftCard` pattern
 * so both the plan draft-project editor and the admin template editor share one
 * proven model.
 *
 * - `pending` holds only the changed fields.
 * - `display` is `{ ...source, ...pending }` so inputs render optimistically.
 * - `dirty` drives the Save/Discard footer.
 * - `editorKey` bumps on discard/save to force RichText editors to remount.
 *
 * The panel component holds this hook in its own state and is re-seeded from a
 * fresh `source` every time the RightPanel remounts it (per `openKey`), which is
 * what keeps it safe against the panel's snapshot-by-value behaviour.
 */
export function useEditorDraft<T extends object>(source: T) {
  const [pending, setPending] = useState<Partial<T>>({});
  const [saving, setSaving] = useState(false);
  const [editorKey, setEditorKey] = useState(0);

  const display = useMemo(() => ({ ...source, ...pending }), [source, pending]);
  const dirty = Object.keys(pending).length > 0;

  const setField = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setPending((prev) => ({ ...prev, [key]: value }));
  }, []);

  const setFields = useCallback((patch: Partial<T>) => {
    setPending((prev) => ({ ...prev, ...patch }));
  }, []);

  const discard = useCallback(() => {
    setPending({});
    setEditorKey((k) => k + 1);
  }, []);

  /**
   * Persist the pending patch. `persist` should PATCH and return the saved
   * subset (or null to abort). On success, pending is cleared and editors reset.
   */
  const save = useCallback(
    async (persist: (pending: Partial<T>) => Promise<Partial<T> | null>): Promise<Partial<T> | null> => {
      if (saving) return null;
      if (Object.keys(pending).length === 0) return null;
      setSaving(true);
      try {
        const saved = await persist(pending);
        if (saved) {
          setPending({});
          setEditorKey((k) => k + 1);
        }
        return saved;
      } finally {
        setSaving(false);
      }
    },
    [pending, saving]
  );

  return { pending, display, dirty, saving, editorKey, setField, setFields, discard, save };
}
