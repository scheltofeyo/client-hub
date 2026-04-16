"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronRight, Plus, X, RotateCcw } from "lucide-react";
import { cn } from "@/lib/cn";

interface RemovedName {
  name: string;
  timestamp: number;
}

interface WinnerEntry {
  name: string;
  timestamp: number;
}

interface SidePanelProps {
  isOpen: boolean;
  onToggle: () => void;
  activeNames: string[];
  removedNames: RemovedName[];
  allWinners: WinnerEntry[];
  onActiveNamesChange: (names: string[]) => void;
  onRemovedNamesChange: (names: RemovedName[]) => void;
}

export default function SidePanel({
  isOpen,
  onToggle,
  activeNames,
  removedNames,
  allWinners,
  onActiveNamesChange,
  onRemovedNamesChange,
}: SidePanelProps) {
  const [inputValue, setInputValue] = useState("");
  const [activeTab, setActiveTab] = useState<"participants" | "winners">("participants");

  const handleAddName = () => {
    if (inputValue.trim()) {
      const newNames = inputValue
        .split(/[,;\n]+/)
        .map((name) => name.trim())
        .filter((name) => name.length > 0)
        .filter((name) => !activeNames.includes(name));

      if (newNames.length > 0) {
        onActiveNamesChange([...activeNames, ...newNames]);
        setInputValue("");
      }
    }
  };

  const handleRemoveName = (index: number) => {
    onActiveNamesChange(activeNames.filter((_, i) => i !== index));
  };

  const handleRestoreName = (name: string) => {
    if (!activeNames.includes(name)) {
      onActiveNamesChange([...activeNames, name]);
    }
    onRemovedNamesChange(removedNames.filter((item) => item.name !== name));
  };

  return (
    <>
      {/* Toggle Button */}
      <motion.button
        onClick={onToggle}
        className={cn(
          "fixed right-0 top-24 z-50 shadow-lg border border-l-0 rounded-l-xl px-2 py-6 transition-colors",
          !isOpen ? "block" : "hidden md:block"
        )}
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border)",
          right: isOpen ? "420px" : "0px",
        }}
        animate={{ right: isOpen ? "420px" : "0px" }}
        transition={{ duration: 0.3 }}
      >
        <motion.div animate={{ rotate: isOpen ? 0 : 180 }} transition={{ duration: 0.3 }}>
          <ChevronRight size={20} style={{ color: "var(--text-muted)" }} />
        </motion.div>
      </motion.button>

      {/* Mobile backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onToggle}
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-full md:w-[420px] shadow-2xl z-50 flex flex-col border-l"
            style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}
          >
            {/* Header */}
            <div
              className="p-6 border-b relative"
              style={{
                borderColor: "var(--border)",
                background: "var(--bg-elevated)",
              }}
            >
              <h2 className="typo-modal-title pr-10 md:pr-0" style={{ color: "var(--text-primary)" }}>
                Manage Participants
              </h2>
              <button
                onClick={onToggle}
                className="absolute top-6 right-6 btn-icon p-2"
                aria-label="Close panel"
              >
                <X size={20} />
              </button>
            </div>

            {/* Add Participant */}
            <div className="p-6 border-b" style={{ borderColor: "var(--border)", background: "var(--bg-hover)" }}>
              <label className="typo-label" style={{ color: "var(--text-primary)" }}>
                Add Participants
              </label>
              <div className="flex gap-2 items-start">
                <textarea
                  placeholder="Enter names (comma or newline separated)"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      handleAddName();
                    }
                  }}
                  rows={3}
                  className="flex-1 rounded-button px-3 py-2 text-sm focus:outline-none resize-none border"
                  style={{
                    background: "var(--bg-surface)",
                    borderColor: "var(--border)",
                    color: "var(--text-primary)",
                  }}
                />
                <button
                  onClick={handleAddName}
                  disabled={!inputValue.trim()}
                  className="btn-primary rounded-button px-4 disabled:opacity-50"
                  style={{ height: "76px" }}
                >
                  <Plus size={20} />
                </button>
              </div>
              <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
                Tip: Add multiple names at once by separating them with commas or line breaks. Press
                Ctrl+Enter (Cmd+Enter on Mac) to add.
              </p>
            </div>

            {/* Tabs */}
            <div className="flex border-b" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
              <button
                onClick={() => setActiveTab("participants")}
                className={cn(
                  "flex-1 px-6 py-4 text-sm font-semibold transition-colors relative",
                  activeTab === "participants" ? "" : "hover:opacity-80"
                )}
                style={{
                  color: activeTab === "participants" ? "var(--primary)" : "var(--text-muted)",
                }}
              >
                Participants ({activeNames.length})
                {activeTab === "participants" && (
                  <motion.div
                    layoutId="spinActiveTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5"
                    style={{ background: "var(--primary)" }}
                  />
                )}
              </button>
              <button
                onClick={() => setActiveTab("winners")}
                className={cn(
                  "flex-1 px-6 py-4 text-sm font-semibold transition-colors relative",
                  activeTab === "winners" ? "" : "hover:opacity-80"
                )}
                style={{
                  color: activeTab === "winners" ? "var(--warning)" : "var(--text-muted)",
                }}
              >
                Winners ({allWinners.length})
                {activeTab === "winners" && (
                  <motion.div
                    layoutId="spinActiveTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5"
                    style={{ background: "var(--warning)" }}
                  />
                )}
              </button>
            </div>

            {/* List Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <AnimatePresence mode="wait">
                {activeTab === "participants" ? (
                  <motion.div
                    key="participants"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-2"
                  >
                    {activeNames.length === 0 ? (
                      <div className="text-center py-12">
                        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                          No active participants
                        </p>
                      </div>
                    ) : (
                      activeNames.map((name, index) => (
                        <motion.div
                          key={`${name}-${index}`}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          transition={{ delay: index * 0.02 }}
                          className="flex items-center justify-between rounded-lg px-4 py-3 group border transition-all"
                          style={{
                            background: "var(--bg-surface)",
                            borderColor: "var(--border)",
                          }}
                        >
                          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                            {name}
                          </span>
                          <button
                            onClick={() => handleRemoveName(index)}
                            className="btn-icon p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X size={16} />
                          </button>
                        </motion.div>
                      ))
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key="winners"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-2"
                  >
                    {allWinners.length === 0 ? (
                      <div className="text-center py-12">
                        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                          No winners yet
                        </p>
                      </div>
                    ) : (
                      allWinners.map((item, index) => {
                        const isRemoved = removedNames.some((r) => r.name === item.name);
                        return (
                          <motion.div
                            key={`${item.name}-${item.timestamp}`}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ delay: index * 0.02 }}
                            className="flex items-center justify-between rounded-lg px-4 py-3 group border transition-all"
                            style={{
                              background: isRemoved ? "var(--danger-light)" : "var(--warning-light)",
                              borderColor: isRemoved ? "var(--danger)" : "var(--warning)",
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <span
                                className="text-xs font-bold px-2 py-1 rounded"
                                style={{
                                  background: isRemoved ? "var(--danger)" : "var(--warning)",
                                  color: "#fff",
                                }}
                              >
                                #{allWinners.length - index}
                              </span>
                              <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                                {item.name}
                              </span>
                            </div>
                            {isRemoved && (
                              <button
                                onClick={() => handleRestoreName(item.name)}
                                className="btn-icon p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Restore to active list"
                              >
                                <RotateCcw size={16} />
                              </button>
                            )}
                          </motion.div>
                        );
                      })
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
