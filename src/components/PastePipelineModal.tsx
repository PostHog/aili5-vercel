"use client";

import { useState, useEffect } from "react";
import { Modal } from "./Modal";
import styles from "./PastePipelineModal.module.css";

interface PastePipelineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPaste: (json: string) => void;
}

export function PastePipelineModal({ isOpen, onClose, onPaste }: PastePipelineModalProps) {
  const [json, setJson] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setJson("");
      setError(null);
    } else {
      // Try to read from clipboard when modal opens
      navigator.clipboard
        .readText()
        .then((text) => {
          setJson(text);
        })
        .catch(() => {
          // Ignore clipboard errors
        });
    }
  }, [isOpen]);

  const handlePaste = () => {
    if (!json.trim()) {
      setError("Please paste a pipeline JSON");
      return;
    }

    try {
      // Validate JSON
      JSON.parse(json);
      onPaste(json);
      onClose();
    } catch (e) {
      setError("Invalid JSON. Please check your pipeline data.");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Paste Pipeline">
      <div className={styles.container}>
        {error && <div className={styles.error}>{error}</div>}
        <textarea
          className={styles.textarea}
          value={json}
          onChange={(e) => {
            setJson(e.target.value);
            setError(null);
          }}
          placeholder="Paste your pipeline JSON here..."
        />
        <div className={styles.actions}>
          <button className={styles.cancelButton} onClick={onClose}>
            Cancel
          </button>
          <button className={styles.pasteButton} onClick={handlePaste}>
            Paste Pipeline
          </button>
        </div>
      </div>
    </Modal>
  );
}

