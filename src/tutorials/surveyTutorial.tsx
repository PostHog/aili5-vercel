"use client";

import { useState } from "react";
import styles from "./Tutorial.module.css";

const EXAMPLE_QUESTIONS = [
  { question: "How helpful was this response?", options: ["Very helpful", "Somewhat helpful", "Not helpful"] },
  { question: "Rate your experience", options: ["Excellent", "Good", "Fair", "Poor"] },
];

export function SurveyTutorial() {
  const [selectedQuestion, setSelectedQuestion] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);

  return (
    <div className={styles.tutorial}>
      <div className={styles.tutorialLeft}>
        <div className={styles.section}>
          <h3>What is a Survey Node?</h3>
          <p>
            The Survey node displays multiple-choice questions that the model generates. Users can
            select an option, and the response can be used for feedback, ratings, or data collection.
          </p>
        </div>

        <div className={styles.section}>
          <h3>How it works</h3>
          <p>
            When an inference node calls the <code>display_survey</code> tool, it specifies a
            question and options. The Survey node displays these as interactive buttons. This is
            useful for collecting user feedback, ratings, or making decisions based on user input.
          </p>
        </div>
      </div>

      <div className={styles.tutorialRight}>
        <div className={styles.section}>
          <h3>Try it yourself</h3>
          <div className={styles.surveyDemo}>
            <div className={styles.surveyQuestion}>
              {EXAMPLE_QUESTIONS[selectedQuestion].question}
            </div>
            <div className={styles.surveyOptions}>
              {EXAMPLE_QUESTIONS[selectedQuestion].options.map((option, i) => (
                <button
                  key={i}
                  className={`${styles.surveyOption} ${selectedOption === i ? styles.surveyOptionSelected : ""}`}
                  onClick={() => setSelectedOption(i)}
                >
                  {option}
                </button>
              ))}
            </div>
            {selectedOption !== null && (
              <div className={styles.surveyResult}>
                Selected: {EXAMPLE_QUESTIONS[selectedQuestion].options[selectedOption]}
              </div>
            )}
          </div>
          <div className={styles.surveyControls}>
            <button
              className={styles.surveyNavButton}
              onClick={() => {
                setSelectedQuestion((prev) => (prev + 1) % EXAMPLE_QUESTIONS.length);
                setSelectedOption(null);
              }}
            >
              Next Question
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
