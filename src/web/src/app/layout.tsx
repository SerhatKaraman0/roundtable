import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Roundtable — 3D Chat',
  description: 'FPS-view 3D chat room with MSN-style buddy characters',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
