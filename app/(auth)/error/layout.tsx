import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Authentication Error',
  description:
    'An authentication error occurred. Please try again or contact support if the problem persists.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function AuthErrorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

