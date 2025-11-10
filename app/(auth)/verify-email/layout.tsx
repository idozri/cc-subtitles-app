import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Verify Email',
  description:
    'Verify your email address to complete your CC Subtitles AI account registration. Enter the verification token sent to your email.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function VerifyEmailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

