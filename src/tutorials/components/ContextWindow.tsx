"use client";

import styles from "./TutorialComponents.module.css";

interface ContextWindowProps {
  items: string[];
  maxItems?: number;
}

export function ContextWindow({ items, maxItems = 5 }: ContextWindowProps) {
  const displayItems = items.slice(-maxItems);

  return (
    <div className={styles.contextWindow}>
      <div className={styles.contextWindowLabel}>Context Window</div>
      <div className={styles.contextWindowBox}>
        {items.length > maxItems && (
          <div className={styles.contextOverflow}>
            +{items.length - maxItems} more items...
          </div>
        )}
        {displayItems.map((item, i) => (
          <div key={i} className={styles.contextItem}>
            {item}
          </div>
        ))}
      </div>
      <div className={styles.contextWindowFooter}>
        {items.length} / {maxItems} items
      </div>
    </div>
  );
}
