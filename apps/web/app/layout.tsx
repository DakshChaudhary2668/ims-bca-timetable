import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "BCA Academic Operations", template: "%s | IMS BCA" },
  description: "Academic setup and faculty records for IMS Ghaziabad UCC.",
};

export default function Layout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
