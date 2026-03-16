"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    const ids = sections.flatMap((s) => s.links.map((l) => l.id));
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter(Boolean) as HTMLElement[];

    if (elements.length === 0) return;

    // Set initial active to first section
    setActiveId(ids[0]);

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the topmost visible entry
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      {
        rootMargin: "-80px 0px -60% 0px",
        threshold: 0,
      }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sections]);

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
