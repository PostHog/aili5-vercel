"use client";

import { useState, useEffect } from "react";
import styles from "./TutorialComponents.module.css";

interface TokenVisualizerProps {
  text: string;
  speed?: number; // milliseconds per token
}

export function TokenVisualizer({ text, speed = 100 }: TokenVisualizerProps) {
  const [displayedText, setDisplayedText] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timer = setTimeout(() => {
        setDisplayedText(text.slice(0, currentIndex + 1));
        setCurrentIndex(currentIndex + 1);
      }, speed);
      return () => clearTimeout(timer);
    }
  }, [currentIndex, text, speed]);

  useEffect(() => {
    setCurrentIndex(0);
    setDisplayedText("");
  }, [text]);

  // Split into words for visualization
  const words = displayedText.split(/(\s+)/);
  const allWords = text.split(/(\s+)/);

  return (
    <div className={styles.tokenVisualizer}>
      <div className={styles.tokenContainer}>
        {words.map((word, i) => {
          const isComplete = word.trim().length > 0;
          return (
            <span
              key={i}
              className={`${styles.token} ${isComplete ? styles.tokenComplete : ""}`}
            >
              {word}
            </span>
          );
        })}
        {currentIndex < text.length && (
          <span className={styles.tokenCursor}>|</span>
        )}
      </div>
      <div className={styles.tokenProgress}>
        {currentIndex} / {text.length} characters
      </div>
    </div>
  );
}
