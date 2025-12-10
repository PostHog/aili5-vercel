"use client";

import { useState } from "react";
import { ColorDisplayNodeEditor } from "@/components/builder/nodes/ColorDisplayNodeEditor";
import type { ColorDisplayConfig, ColorOutput } from "@/types/pipeline";
import styles from "./Tutorial.module.css";

const EXAMPLE_COLORS = [
  { name: "Ocean Blue", hex: "#0066CC" },
  { name: "Sunset Orange", hex: "#FF6600" },
  { name: "Forest Green", hex: "#228B22" },
  { name: "Lavender", hex: "#E6E6FA" },
];

export function ColorDisplayTutorial() {
  const [config, setConfig] = useState<ColorDisplayConfig>({ showHex: true });
  const [output, setOutput] = useState<ColorOutput | null>(null);

  const handleGenerateColor = (colorName: string) => {
    const color = EXAMPLE_COLORS.find((c) => c.name === colorName);
    if (color) {
      setOutput({
        hex: color.hex,
        name: color.name,
      });
    }
  };

  return (
    <div className={styles.tutorial}>
      <div className={styles.tutorialLeft}>
        <div className={styles.section}>
          <h3>What is a Color Display Node?</h3>
          <p>
            The Color Display node shows colors that the model generates. The model can output
            colors by name or hex code, and this node displays them visually.
          </p>
        </div>

        <div className={styles.section}>
          <h3>How it works</h3>
          <p>
            When an inference node calls the <code>display_color</code> tool, it can specify a
            color by name or hex code. The Color Display node receives this and shows a visual
            color swatch. This is useful for color palettes, design tools, or any application
            where the model needs to output colors.
          </p>
        </div>
      </div>

      <div className={styles.tutorialRight}>
        <div className={styles.section}>
          <h3>Try it yourself</h3>
          <p>Click a color to see it displayed:</p>
          <div className={styles.colorGrid}>
            {EXAMPLE_COLORS.map((color) => (
              <button
                key={color.name}
                className={styles.colorButton}
                style={{ backgroundColor: color.hex }}
                onClick={() => handleGenerateColor(color.name)}
              >
                {color.name}
              </button>
            ))}
          </div>
          <div className={styles.liveDemo}>
            <ColorDisplayNodeEditor
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
