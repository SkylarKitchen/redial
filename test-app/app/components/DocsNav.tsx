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
        <svg width="20" height="16" viewBox="0 0 50 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M43 31L31 40H5L7 35L12 31H29L32 35L40 11L45 7H50L43 31ZM43 5L38 9H21L18 5L10 29L5 33H0L7 9L19 0H45L43 5ZM24 13H35L29 31L26 27H15L21 9L24 13Z" fill="currentColor"/>
        </svg>
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
