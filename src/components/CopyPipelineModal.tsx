"use client";

import { useState, useEffect } from "react";
import { Modal } from "./Modal";
import { Copy, Check } from "lucide-react";
import styles from "./CopyPipelineModal.module.css";

interface CopyPipelineModalProps {
  isOpen: boolean;
  onClose: () => void;
  pipelineJson: string;
}

export function CopyPipelineModal({ isOpen, onClose, pipelineJson }: CopyPipelineModalProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setCopied(false);
    }
  }, [isOpen]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(pipelineJson);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Copy Pipeline">
      <div className={styles.container}>
        <div className={styles.actions}>
          <button className={styles.copyButton} onClick={handleCopy}>
            {copied ? (
              <>
                <Check size={18} />
                Copied!
              </>
            ) : (
              <>
                <Copy size={18} />
                Copy to Clipboard
              </>
            )}
          </button>
        </div>
        <textarea
          className={styles.textarea}
          value={pipelineJson}
          readOnly
          onClick={(e) => e.currentTarget.select()}
        />
      </div>
    </Modal>
  );
}

