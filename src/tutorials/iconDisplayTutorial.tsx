"use client";

import { useState } from "react";
import { IconDisplayNodeEditor } from "@/components/builder/nodes/IconDisplayNodeEditor";
import type { IconDisplayConfig, IconOutput } from "@/types/pipeline";
import styles from "./Tutorial.module.css";

const EXAMPLE_ICONS = [
  { id: "heart", label: "Heart" },
  { id: "star", label: "Star" },
  { id: "sparkles", label: "Sparkles" },
  { id: "fire", label: "Fire" },
] as const;

export function IconDisplayTutorial() {
  const [config, setConfig] = useState<IconDisplayConfig>({ size: "md" });
  const [output, setOutput] = useState<IconOutput | null>(null);

  const handleGenerateIcon = (iconId: string) => {
    const icon = EXAMPLE_ICONS.find((i) => i.id === iconId);
    if (icon) {
      setOutput({
        id: icon.id,
        label: icon.label,
      });
    }
  };

  return (
    <div className={styles.tutorial}>
      <div className={styles.tutorialLeft}>
        <div className={styles.section}>
          <h3>What is an Icon Display Node?</h3>
          <p>
            The Icon Display node shows icons that the model generates. The model can output icon
            names, and this node displays them using Lucide icons.
          </p>
        </div>

        <div className={styles.section}>
          <h3>How it works</h3>
          <p>
            When an inference node calls the <code>display_icon</code> tool, it specifies an icon
            name from the Lucide icon library. The Icon Display node receives this and shows the
            corresponding icon. This is useful for UI elements, status indicators, or visual
            representations of concepts.
          </p>
        </div>
      </div>

      <div className={styles.tutorialRight}>
        <div className={styles.section}>
          <h3>Try it yourself</h3>
          <p>Click an icon to see it displayed:</p>
          <div className={styles.iconGrid}>
            {EXAMPLE_ICONS.map((icon) => (
              <button
                key={icon.id}
                className={styles.iconButton}
                onClick={() => handleGenerateIcon(icon.id)}
              >
                {icon.label}
              </button>
            ))}
          </div>
          <div className={styles.liveDemo}>
            <IconDisplayNodeEditor
              config={config}
              onChange={setConfig}
              output={output}
              loading={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
