import '../globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'AstroAlign',
  description: 'Astronomical photography alignment planning tool.'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
