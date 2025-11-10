import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My Projects',
  description:
    'Manage your video projects and track upload progress. View, edit, and organize all your transcription projects in one place.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function ProjectsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

