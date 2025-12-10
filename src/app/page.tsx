"use client";

import { useState } from "react";
import { PipelineBuilder } from "@/components/builder";
import { usePipelineStore } from "@/store/pipelineStore";
import { Trash2, Copy, ClipboardPaste } from "lucide-react";
import { CopyPipelineModal } from "@/components/CopyPipelineModal";
import { PastePipelineModal } from "@/components/PastePipelineModal";
import styles from "./page.module.css";

export default function Home() {
  const clearPipeline = usePipelineStore((state) => state.clearPipeline);
  const getSerializedPipeline = usePipelineStore((state) => state.getSerializedPipeline);
  const pastePipeline = usePipelineStore((state) => state.pastePipeline);
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [pasteModalOpen, setPasteModalOpen] = useState(false);

  const handleCopy = () => {
    setCopyModalOpen(true);
  };

  const handlePaste = () => {
    setPasteModalOpen(true);
  };

  const handlePasteConfirm = (json: string) => {
    try {
      pastePipeline(json);
    } catch (error) {
      console.error("Failed to paste pipeline:", error);
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div>
            <h1 className={styles.title}>aili5</h1>
            <p className={styles.subtitle}>Learn how LLMs work by building a pipeline</p>
          </div>
          <div className={styles.buttonGroup}>
            <button className={styles.actionButton} onClick={handleCopy} title="Copy pipeline">
              <Copy size={18} />
              Copy
            </button>
            <button className={styles.actionButton} onClick={handlePaste} title="Paste pipeline">
              <ClipboardPaste size={18} />
              Paste
            </button>
            <button className={styles.actionButton} onClick={clearPipeline} title="Clear pipeline">
              <Trash2 size={18} />
              Clear
            </button>
          </div>
        </div>
      </header>

      <main className={styles.builderContainer}>
        <PipelineBuilder />
      </main>

      <CopyPipelineModal
        isOpen={copyModalOpen}
        onClose={() => setCopyModalOpen(false)}
        pipelineJson={getSerializedPipeline()}
      />
      <PastePipelineModal
        isOpen={pasteModalOpen}
        onClose={() => setPasteModalOpen(false)}
        onPaste={handlePasteConfirm}
      />
    </div>
  );
}
