"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  {
    href: "/overview",
    label: "Overview",
    icon: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  },
  {
    href: "/setup",
    label: "Academic setup",
    icon: "M4 6h16 M4 12h16 M4 18h16 M8 4v4 M16 10v4 M8 16v4",
  },
  {
    href: "/faculty",
    label: "Faculty",
    icon: "M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2 M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M21 21v-2a4 4 0 0 0-3-4 M17 3a4 4 0 0 1 0 8",
  },
  {
    href: "/subjects",
    label: "Subjects",
    icon: "M4 5a2 2 0 0 1 2-2h14v18H6a2 2 0 0 1-2-2z M4 17h16 M8 7h8 M8 11h6",
  },
];

export function Navigation() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main navigation" className="navigation">
      <a href="/">Weekly timetable</a>
      {links.map(({ href, label, icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={pathname === href ? "page" : undefined}
        >
          <svg
            aria-hidden="true"
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d={icon} />
          </svg>
          {label}
        </Link>
      ))}
    </nav>
  );
}
