"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PipelineBuilder } from "@/components/builder";
import { usePipelineStore } from "@/store/pipelineStore";
import { useAuth } from "@/hooks/useAuth";
import { Trash2, Copy, ClipboardPaste, LogOut } from "lucide-react";
import { CopyPipelineModal } from "@/components/CopyPipelineModal";
import { PastePipelineModal } from "@/components/PastePipelineModal";
import { LoginScreen } from "@/components/auth";
import styles from "./page.module.css";

function HomeContent() {
  const searchParams = useSearchParams();
  const authError = searchParams.get("auth_error");

  const { isAuthenticated, isLoading, projectId, logout } = useAuth();

  const clearPipeline = usePipelineStore((state) => state.clearPipeline);
  const getSerializedPipeline = usePipelineStore((state) => state.getSerializedPipeline);
  const pastePipeline = usePipelineStore((state) => state.pastePipeline);
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [pasteModalOpen, setPasteModalOpen] = useState(false);

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.loadingSpinner} />
        <p>Loading...</p>
      </div>
    );
  }

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return <LoginScreen error={authError} />;
  }

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
            <p className={styles.subtitle}>Your LLM toybox awaits</p>
          </div>
          <div className={styles.buttonGroup}>
            <span className={styles.projectBadge}>Project #{projectId}</span>
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
            <button className={styles.actionButton} onClick={logout} title="Log out">
              <LogOut size={18} />
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

export default function Home() {
  return (
    <Suspense fallback={
      <div className={styles.loadingScreen}>
        <div className={styles.loadingSpinner} />
        <p>Loading...</p>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
