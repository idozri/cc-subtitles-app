import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Reset Password',
  description:
    'Enter your new password to reset your CC Subtitles AI account password.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function ResetPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

