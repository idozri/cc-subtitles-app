import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Create New Project',
  description:
    'Create a new video transcription project. Upload your video or audio file and let our AI generate accurate subtitles in your preferred language.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function NewProjectV2Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

