"use client";

import { useEffect, useState, useCallback } from "react";
import styles from "../docs.module.scss";

interface SidebarSection {
  title: string;
  links: { id: string; label: string }[];
}

export default function DocsSidebar({
  sections,
}: {
  sections: SidebarSection[];
}) {
  const [activeId, setActiveId] = useState<string>("");

  const ids = sections.flatMap((s) => s.links.map((l) => l.id));

  const handleScroll = useCallback(() => {
    const offset = 120; // nav height + margin
    let current = ids[0] || "";

    for (const id of ids) {
      const el = document.getElementById(id);
      if (el && el.getBoundingClientRect().top <= offset) {
        current = id;
      }
    }

    setActiveId(current);
  }, [ids]);

  useEffect(() => {
    handleScroll(); // set initial
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  return (
    <aside className={styles.sidebar}>
      {sections.map((section) => (
        <div key={section.title} className={styles.sidebarSection}>
          <h4>{section.title}</h4>
          {section.links.map((link) => (
            <a
              key={link.id}
              href={`#${link.id}`}
              className={`${styles.sidebarLink}${
                activeId === link.id ? ` ${styles.sidebarLinkActive}` : ""
              }`}
            >
              {link.label}
            </a>
          ))}
        </div>
      ))}
    </aside>
  );
}
