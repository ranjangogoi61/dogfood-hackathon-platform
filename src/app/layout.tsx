import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dogfood",
  description: "Offline-first, self-hostable hackathon platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0 }}>
        {children}
      </body>
    </html>
  );
}
