import "./globals.css";

export const metadata = {
  title: "TBC Classic Anniversary Activity",
  description: "Arena activity leaderboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
