"use client";

import { useState, useEffect } from "react";
import { SystemPromptNodeEditor } from "@/components/builder/nodes/SystemPromptNodeEditor";
import type { SystemPromptConfig, TextOutput } from "@/types/pipeline";
import { runInference } from "@/services/inference/api";
import ReactMarkdown from "react-markdown";
import styles from "./Tutorial.module.css";

const PRESETS = [
  { name: "Helpful Assistant", prompt: "You are a helpful, harmless, and honest assistant." },
  { name: "Pirate", prompt: "You are a friendly pirate. Speak like a pirate and be adventurous!" },
  { name: "Strict Teacher", prompt: "You are a strict but fair teacher. Be precise and educational." },
  { name: "Creative Writer", prompt: "You are a creative writer. Be imaginative and descriptive." },
];

const DEMO_QUESTIONS = [
  "Tell me about butterflies",
  "What is the capital of France?",
  "Explain quantum physics",
  "Write a haiku about the ocean",
];

const DEMO_RESPONSES: Record<string, string[]> = {
  "Helpful Assistant": [
    "Butterflies are beautiful insects that undergo metamorphosis. They start as caterpillars and transform into winged creatures with colorful patterns.",
    "The capital of France is Paris, a beautiful city known for its art, culture, and history.",
    "Quantum physics is the study of matter and energy at the smallest scales, where particles behave in ways that seem counterintuitive.",
    "Waves crash on shore, / Endless blue meets golden sand, / Nature's gentle song.",
  ],
  "Pirate": [
    "Arr! Butterflies be magnificent creatures of the sky, flutterin' their colorful wings like sails in the wind! They start as wee caterpillars and transform into beauties that'd make any pirate's heart sing!",
    "Ahoy! The capital of France be Paris, matey! A grand city full of treasures, art, and adventure on every corner!",
    "Avast! Quantum physics be like navigatin' uncharted waters - particles be behavin' in strange ways that'd confound even the wisest sea captain!",
    "Ocean's mighty roar, / Treasure hidden in the deep, / Adventure awaits!",
  ],
  "Strict Teacher": [
    "Butterflies are insects belonging to the order Lepidoptera. They undergo complete metamorphosis: egg, larva (caterpillar), pupa (chrysalis), and adult. This transformation is a fundamental biological process.",
    "The capital of France is Paris. It is located in the north-central part of the country and serves as the political, economic, and cultural center of France.",
    "Quantum physics is a branch of physics that studies matter and energy at atomic and subatomic scales. Key principles include wave-particle duality, uncertainty, and quantum entanglement.",
    "Ocean waves crash down, / Endless water meets the shore, / Nature's constant rhythm.",
  ],
  "Creative Writer": [
    "Butterflies are nature's living poetry, delicate dancers painted with the colors of dreams. They begin as humble caterpillars, crawling through life, then retreat into a chrysalis—a cocoon of transformation—emerging as winged masterpieces that flutter through gardens like floating flowers.",
    "Paris, the City of Light, where romance whispers through cobblestone streets and art lives in every corner. It's a place where history and modernity dance together, where the Eiffel Tower pierces the sky and the Seine flows like liquid silver.",
    "Quantum physics is the universe's secret language, where particles exist in multiple states simultaneously, where observation changes reality itself. It's a realm where the impossible becomes possible, where matter and energy blur into a cosmic dance of probability and wonder.",
    "Azure depths call out, / Waves like verses in motion, / Eternal blue song.",
  ],
};

export function SystemPromptTutorial() {
  const [config, setConfig] = useState<SystemPromptConfig>({
    prompt: PRESETS[0].prompt,
  });
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [question, setQuestion] = useState("Tell me about butterflies");
  const [output, setOutput] = useState<TextOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [streamingResponse, setStreamingResponse] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  
  // Animated conversation state
  const [currentDemoIndex, setCurrentDemoIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [displayedResponse, setDisplayedResponse] = useState("");

  const handlePresetSelect = (index: number) => {
    setSelectedPreset(index);
    setConfig({ prompt: PRESETS[index].prompt });
    // Clear output when changing system prompt to show the effect
    setOutput(null);
  };

  const handleRun = async () => {
    setLoading(true);
    setOutput(null);
    setStreamingResponse("");
    setIsStreaming(false);

    try {
      // Add constraint for streaming-friendly responses
      const enhancedSystemPrompt = `${config.prompt}\n\nImportant: Respond with plain text only. Do not use markdown formatting, code blocks, or special characters. Write naturally in a way that streams well word-by-word.`;
      
      const result = await runInference({
        systemPrompt: enhancedSystemPrompt,
        userMessage: question,
        model: "claude-3-haiku-20240307",
        temperature: 0.4,
      });

      if (result.response) {
        const response = result.response;
        // Start streaming the response word-by-word
        setIsStreaming(true);
        const words = response.match(/\S+|\s+/g) || [];
        let wordIndex = 0;

        const streamInterval = setInterval(() => {
          if (wordIndex < words.length) {
            setStreamingResponse(words.slice(0, wordIndex + 1).join(""));
            wordIndex++;
          } else {
            clearInterval(streamInterval);
            setIsStreaming(false);
            setOutput({ content: response });
          }
        }, 80); // Same speed as the demo
      }
    } catch (error) {
      console.error("Inference error:", error);
    } finally {
      setLoading(false);
    }
  };

  // Animated conversation loop
  useEffect(() => {
    const currentPreset = PRESETS[currentDemoIndex];
    const currentQuestion = DEMO_QUESTIONS[currentQuestionIndex];
    const responses = DEMO_RESPONSES[currentPreset.name] || [];
    const response = responses[currentQuestionIndex] || "";

    // Start typing animation
    setIsTyping(true);
    setDisplayedResponse("");

    // Split response into words (preserving spaces and punctuation)
    const words = response.match(/\S+|\s+/g) || [];
    let wordIndex = 0;

    // Type out the response word by word (karaoke style)
    const typeInterval = setInterval(() => {
      if (wordIndex < words.length) {
        setDisplayedResponse(words.slice(0, wordIndex + 1).join(""));
        wordIndex++;
      } else {
        clearInterval(typeInterval);
        setIsTyping(false);
        
        // Wait a bit, then move to next question and character
        setTimeout(() => {
          setCurrentQuestionIndex((prev) => (prev + 1) % DEMO_QUESTIONS.length);
          // Cycle through characters every turn
          setCurrentDemoIndex((prev) => (prev + 1) % PRESETS.length);
        }, 2000);
      }
    }, 80); // Word-by-word speed (faster than character-by-character)

    return () => clearInterval(typeInterval);
  }, [currentDemoIndex, currentQuestionIndex]);

  const currentDemoPreset = PRESETS[currentDemoIndex];
  const currentDemoQuestion = DEMO_QUESTIONS[currentQuestionIndex];

  return (
    <div className={styles.tutorial}>
      <div className={styles.tutorialLeft}>
        <div className={styles.section}>
          <h3>What is a System Prompt?</h3>
          <p>
            The system prompt sets the model's personality, behavior, and instructions. It's like
            giving the model a role to play.
          </p>
        </div>

        <div className={styles.section}>
          <h3>Watch it in action</h3>
          <div className={styles.animatedConversation}>
            <div className={styles.conversationHeader}>
              <span className={styles.characterName}>{currentDemoPreset.name}</span>
              {isTyping && <span className={styles.typingIndicator}>...</span>}
            </div>
            <div className={styles.conversationQuestion}>
              <strong>Q:</strong> {currentDemoQuestion}
            </div>
            {displayedResponse && (
              <div className={styles.conversationResponse}>
                <strong>A:</strong> {displayedResponse}
              </div>
            )}
          </div>
        </div>

        <div className={styles.section}>
          <h3>How it works</h3>
          <p>
            The system prompt is sent to the model before every inference. It tells the model how
            to behave, what tone to use, and what instructions to follow. All inference nodes
            in your pipeline will use this system prompt.
          </p>
          <p>
            Change the system prompt on the right and see how it affects the model's responses!
          </p>
        </div>
      </div>

      <div className={styles.tutorialRight}>
        <div className={styles.section}>
          <h3>Try different characters</h3>
          <div className={styles.presetGrid}>
            {PRESETS.map((preset, i) => (
              <button
                key={i}
                className={`${styles.presetButton} ${selectedPreset === i ? styles.presetButtonActive : ""}`}
                onClick={() => handlePresetSelect(i)}
              >
                {preset.name}
              </button>
            ))}
          </div>
          <div className={styles.liveDemo}>
            <SystemPromptNodeEditor config={config} onChange={setConfig} />
          </div>
        </div>

        <div className={styles.section}>
          <h3>Try it with this prompt</h3>
          <div className={styles.simpleQnA}>
            <div className={styles.questionRow}>
              <input
                type="text"
                className={styles.questionInput}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask a question..."
                disabled={loading}
              />
              <button
                className={styles.askButton}
                onClick={handleRun}
                disabled={loading || isStreaming || !question.trim()}
              >
                {loading ? "Asking..." : isStreaming ? "Streaming..." : "Ask"}
              </button>
            </div>
            {(streamingResponse || output) && (
              <div className={styles.response}>
                <strong>A:</strong>{" "}
                {isStreaming ? (
                  <span>
                    {streamingResponse}
                    <span className={styles.typingIndicator}>|</span>
                  </span>
                ) : (
                  <span>{output?.content || streamingResponse}</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
