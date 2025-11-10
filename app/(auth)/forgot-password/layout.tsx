import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Reset Password',
  description:
    "Reset your CC Subtitles AI account password. Enter your email address and we'll send you a link to reset your password.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ForgotPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

