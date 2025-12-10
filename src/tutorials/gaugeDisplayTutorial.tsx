"use client";

import { useState } from "react";
import type { GaugeDisplayConfig } from "@/types/pipeline";
import styles from "./Tutorial.module.css";

export function GaugeDisplayTutorial() {
  const [config, setConfig] = useState<GaugeDisplayConfig>({
    style: "bar",
    showValue: true,
  });
  const [value, setValue] = useState(75);

  return (
    <div className={styles.tutorial}>
      <div className={styles.tutorialLeft}>
        <div className={styles.section}>
          <h3>What is a Gauge Display Node?</h3>
          <p>
            The Gauge Display node shows numeric values as visual gauges. The model can output
            numbers, and this node displays them as bars, circles, or other gauge styles.
          </p>
        </div>

        <div className={styles.section}>
          <h3>How it works</h3>
          <p>
            When an inference node calls the <code>display_gauge</code> tool, it specifies a
            numeric value. The Gauge Display node receives this and shows it as a visual gauge.
            This is useful for scores, percentages, ratings, or any numeric metric that benefits
            from visual representation.
          </p>
        </div>
      </div>

      <div className={styles.tutorialRight}>
        <div className={styles.section}>
          <h3>Try it yourself</h3>
          <div className={styles.gaugeDemo}>
            <label className={styles.label}>
              Value: {value}
              <input
                type="range"
                min="0"
                max="100"
                value={value}
                onChange={(e) => setValue(Number(e.target.value))}
                className={styles.slider}
              />
            </label>
            <div className={styles.gaugePreview}>
              <div
                className={styles.gaugeBar}
                style={{ width: `${value}%` }}
              />
            </div>
            <div className={styles.gaugeValue}>{value}%</div>
          </div>
        </div>
      </div>
    </div>
  );
}
