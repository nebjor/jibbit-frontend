import type { ReactNode } from "react";
import styles from "./Prose.module.css";

/** Shared text-page shell for legal and customer-service content. */
export function Prose({
  title,
  intro,
  updated,
  children,
}: {
  title: string;
  intro?: string;
  updated?: string;
  children: ReactNode;
}) {
  return (
    <article className={`page ${styles.wrap}`}>
      <header className={styles.head}>
        <h1 className={styles.title}>{title}</h1>
        {intro && <p className={styles.intro}>{intro}</p>}
        {updated && <p className={styles.updated}>Stand: {updated}</p>}
      </header>
      <div className={styles.body}>{children}</div>
    </article>
  );
}

/**
 * A field the operator still has to supply. Rendered visibly so nobody ships
 * the site with invented company data.
 */
export function Platzhalter({ children }: { children: ReactNode }) {
  return (
    <mark className={styles.placeholder}>[[PLATZHALTER: {children}]]</mark>
  );
}
