"use client";

import { useState } from "react";
import styles from "./Tutorial.module.css";

export function WebhookTriggerTutorial() {
  const [isTriggered, setIsTriggered] = useState(false);
  const [requestData, setRequestData] = useState({ url: "https://api.example.com/webhook", method: "POST" });

  const handleTrigger = () => {
    setIsTriggered(true);
    setTimeout(() => setIsTriggered(false), 2000);
  };

  return (
    <div className={styles.tutorial}>
      <div className={styles.tutorialLeft}>
        <div className={styles.section}>
          <h3>What is a Webhook Trigger Node?</h3>
          <p>
            The Webhook Trigger node sends HTTP requests to external APIs when the model decides
            to trigger an action. This allows the model to interact with external services.
          </p>
        </div>

        <div className={styles.section}>
          <h3>How it works</h3>
          <p>
            When an inference node calls the <code>trigger_webhook</code> tool, it specifies a
            URL and optional data. The Webhook Trigger node sends an HTTP request to that URL.
            This is useful for integrating with external APIs, triggering actions, or sending
            notifications.
          </p>
        </div>
      </div>

      <div className={styles.tutorialRight}>
        <div className={styles.section}>
          <h3>Try it yourself</h3>
          <div className={styles.webhookDemo}>
            <div className={styles.webhookConfig}>
              <div className={styles.webhookField}>
                <label>URL:</label>
                <input
                  type="text"
                  value={requestData.url}
                  onChange={(e) => setRequestData({ ...requestData, url: e.target.value })}
                  className={styles.webhookInput}
                />
              </div>
              <button
                className={styles.triggerButton}
                onClick={handleTrigger}
                disabled={isTriggered}
              >
                {isTriggered ? "Sending..." : "Trigger Webhook"}
              </button>
            </div>
            {isTriggered && (
              <div className={styles.webhookAnimation}>
                <div className={styles.webhookRequest}>
                  <div className={styles.webhookArrow}>→</div>
                  <div className={styles.webhookBubble}>
                    POST {requestData.url}
                  </div>
                </div>
                <div className={styles.webhookResponse}>
                  <div className={styles.webhookBubble}>200 OK</div>
                  <div className={styles.webhookArrow}>←</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
