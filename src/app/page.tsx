"use client";

import { PipelineBuilder } from "@/components/builder";
import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>aili5</h1>
        <p className={styles.subtitle}>Learn how LLMs work by building a pipeline</p>
      </header>

      <main className={styles.builderContainer}>
        <PipelineBuilder />
      </main>
    </div>
  );
}
