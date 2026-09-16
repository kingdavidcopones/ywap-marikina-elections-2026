import type {Metadata} from 'next';
import '@fontsource-variable/figtree';
import '@astryxdesign/core/reset.css';
import '@astryxdesign/core/astryx.css';
import '@/lib/ywap-marikina.css';
import './globals.css';
import {Providers} from './providers';

export const metadata: Metadata = {
  title: {
    default: 'YWAP Marikina Elections 2026',
    template: '%s · YWAP Marikina Elections 2026',
  },
  description: 'A clear, private way to vote in the YWAP Marikina 2026 elections.',
  icons: {icon: '/brand/ywap-marikina-elections-logo-mark.svg'},
};

export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
