"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";

/**
 * One-click new plan creation. POSTs with a default title + VAT and jumps
 * straight into the plan detail page so the user can start editing.
 */
export default function AddPlanButton({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  async function createPlan() {
    if (creating) return;
    setCreating(true);
    const res = await fetch(`/api/clients/${clientId}/plans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New project plan", vatRate: 21 }),
    });
    if (!res.ok) {
      setCreating(false);
      return;
    }
    const created = await res.json();
    window.dispatchEvent(new CustomEvent("plan-created"));
    router.push(`/clients/${clientId}/projects/plans/${created.id}`);
  }

  return (
    <button
      onClick={createPlan}
      disabled={creating}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium btn-border border disabled:opacity-60"
    >
      {creating ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
      {creating ? "Creating…" : "Add Plan"}
    </button>
  );
}
