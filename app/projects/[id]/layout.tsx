import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return {
    title: 'Project Details',
    description: `View and edit your video transcription project. Manage subtitles, translations, and export your project in various formats.`,
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default function ProjectDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

