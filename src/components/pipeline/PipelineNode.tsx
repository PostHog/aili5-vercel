import styles from "./PipelineNode.module.css";

interface PipelineNodeProps {
  title: string;
  description: string;
  children: React.ReactNode;
  isLast?: boolean;
}

export function PipelineNode({
  title,
  description,
  children,
  isLast = false,
}: PipelineNodeProps) {
  return (
    <div className={styles.nodeWrapper}>
      <div className={styles.node}>
        <div className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <p className={styles.description}>{description}</p>
        </div>
        <div className={styles.content}>{children}</div>
      </div>
      {!isLast && <div className={styles.connector} />}
    </div>
  );
}
