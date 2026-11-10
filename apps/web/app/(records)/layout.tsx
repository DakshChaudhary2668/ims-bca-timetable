import Image from "next/image";
import Link from "next/link";
import { Navigation } from "../../components/navigation";
import "../globals.css";

export default function RecordsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@600;700&display=swap"
      />
      <a className="skip" href="#main">
        Skip to content
      </a>
      <div className="shell">
        <aside className="sidebar">
          <Link
            href="/overview"
            className="brand"
            aria-label="IMS Ghaziabad overview"
          >
            <Image
              src="/ims-ghaziabad.png"
              alt="IMS Ghaziabad University Courses Campus"
              width={640}
              height={292}
              unoptimized
            />
          </Link>
          <Navigation />
          <p className="sidebar-footer">BCA programme workspace</p>
        </aside>
        <header className="topbar">
          <span>Academic operations</span>
          <span className="programme-tag">BCA programme</span>
        </header>
        <main id="main" className="sheet">
          {children}
        </main>
      </div>
    </>
  );
}
