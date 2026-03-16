"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "../docs.module.scss";

const navLinks = [
  { href: "/", label: "Overview" },
  { href: "/install", label: "Install" },
  { href: "/features", label: "Features" },
];

export default function DocsNav() {
  const pathname = usePathname();

  return (
    <nav className={styles.topNav}>
      <Link href="/" className={styles.navLogo}>
        Redial
      </Link>
      <div className={styles.navLinks}>
        {navLinks.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={pathname === href ? styles.navActive : undefined}
          >
            {label}
          </Link>
        ))}
      </div>
      <div className={styles.navLinksRight}>
        <a
          href="https://github.com/SkylarKitchen/redial"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub
        </a>
      </div>
    </nav>
  );
}
