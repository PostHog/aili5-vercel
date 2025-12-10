"use client";

import { useState } from "react";
import { PixelArtDisplayNodeEditor } from "@/components/builder/nodes/PixelArtDisplayNodeEditor";
import type { PixelArtDisplayConfig, PixelArtOutput } from "@/types/pipeline";
import styles from "./Tutorial.module.css";

export function PixelArtDisplayTutorial() {
  const [config, setConfig] = useState<PixelArtDisplayConfig>({ pixelSize: 32 });
  const [output, setOutput] = useState<PixelArtOutput | null>(null);

  const handleGeneratePixelArt = () => {
    // Create a simple 8x8 pixel art pattern
    const pixels: string[][] = [];
    for (let y = 0; y < 8; y++) {
      pixels[y] = [];
      for (let x = 0; x < 8; x++) {
        const pattern = (x + y) % 2 === 0 ? "#FF6B6B" : "#4ECDC4";
        pixels[y][x] = pattern;
      }
    }
    setOutput({ pixels });
  };

  return (
    <div className={styles.tutorial}>
      <div className={styles.tutorialLeft}>
        <div className={styles.section}>
          <h3>What is a Pixel Art Display Node?</h3>
          <p>
            The Pixel Art Display node shows pixel art images that the model generates. The model
            can output a grid of colors, and this node displays them as pixel art.
          </p>
        </div>

        <div className={styles.section}>
          <h3>How it works</h3>
          <p>
            When an inference node calls the <code>display_pixel_art</code> tool, it specifies
            a grid of colors (pixels). The Pixel Art Display node receives this and renders it
            as pixel art. This is useful for generating simple images, patterns, or visual
            representations.
          </p>
        </div>
      </div>

      <div className={styles.tutorialRight}>
        <div className={styles.section}>
          <h3>Try it yourself</h3>
          <button className={styles.generateButton} onClick={handleGeneratePixelArt}>
            Generate Sample Pixel Art
          </button>
          <div className={styles.liveDemo}>
            <PixelArtDisplayNodeEditor
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
