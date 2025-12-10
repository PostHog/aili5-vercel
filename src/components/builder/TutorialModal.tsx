"use client";

import { Modal } from "@/components/Modal";
import { TUTORIALS } from "@/tutorials";
import type { NodeType } from "@/types/pipeline";
import { MODULE_DEFINITIONS, SYSTEM_PROMPT_MODULE } from "./ModulePalette";
import styles from "./TutorialModal.module.css";

interface TutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodeType: NodeType | null;
}

export function TutorialModal({ isOpen, onClose, nodeType }: TutorialModalProps) {
  if (!nodeType || !isOpen) return null;

  const TutorialComponent = TUTORIALS[nodeType];
  if (!TutorialComponent) return null;

  // Get node name for title
  const moduleInfo = nodeType === "system_prompt"
    ? SYSTEM_PROMPT_MODULE
    : MODULE_DEFINITIONS.find((m) => m.type === nodeType);

  const title = moduleInfo ? `${moduleInfo.name} Tutorial` : "Tutorial";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} className={styles.tutorialModal}>
      <div className={styles.tutorialContent}>
        <TutorialComponent />
      </div>
    </Modal>
  );
}
