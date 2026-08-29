import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MVP Timer',
  description: 'Timer de respawn de MVPs de Ragnarok Online, compartilhado com a guild.',
  /* A página vai virar link secreto de guild: fora do índice do Google. */
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
