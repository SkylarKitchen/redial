import Link from "next/link";
import styles from "../docs.module.scss";

interface PageNavProps {
  prev?: { href: string; label: string };
  next?: { href: string; label: string };
}

export default function PageNav({ prev, next }: PageNavProps) {
  return (
    <nav className={styles.pageNav}>
      {prev ? (
        <Link href={prev.href} className={styles.pageNavLink}>
          <span className={styles.pageNavDirection}>&larr; Previous</span>
          <span className={styles.pageNavLabel}>{prev.label}</span>
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link
          href={next.href}
          className={`${styles.pageNavLink} ${styles.pageNavLinkNext}`}
        >
          <span className={styles.pageNavDirection}>Next &rarr;</span>
          <span className={styles.pageNavLabel}>{next.label}</span>
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
