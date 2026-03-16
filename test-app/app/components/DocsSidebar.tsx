"use client";

import { useEffect, useRef, useState } from "react";
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
  const idsRef = useRef(sections.flatMap((s) => s.links.map((l) => l.id)));

  useEffect(() => {
    const ids = idsRef.current;

    function onScroll() {
      const offset = 120;
      let current = ids[0] || "";

      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= offset) {
          current = id;
        }
      }

      setActiveId((prev) => (prev === current ? prev : current));
    }

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
