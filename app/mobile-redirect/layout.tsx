import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Redirecting to Mobile App',
  description:
    'Redirecting to the CC Subtitles AI mobile app. If the app does not open automatically, please use the link provided.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function MobileRedirectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

