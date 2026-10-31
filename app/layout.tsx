import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('http://localhost:3000'),
  title: 'Cam the Mower Man — Thunder Cut',
  description:
    'An original five-reel mowing-and-thunder demo with free games, Coin Storm respins, Thunder Charge and progressive jackpots.',
  openGraph: {
    title: 'Cam the Mower Man — Thunder Cut',
    description: 'Coin Storm. Thunder Charge. One very bright forecast.',
    type: 'website',
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'Cam the Mower Man, a ride-on mower and dog in the bright pink, yellow, green and purple Thunder Cut artwork.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Cam the Mower Man — Thunder Cut',
    description: 'Coin Storm. Thunder Charge. One very bright forecast.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
