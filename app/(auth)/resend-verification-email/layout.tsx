import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Resend Verification Email',
  description:
    'Resend the verification email to your registered email address for your CC Subtitles AI account.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function ResendVerificationEmailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

