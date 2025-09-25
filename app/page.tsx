'use client';

import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { Plus, Play, FileText, FolderOpen, Upload } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { useProjects } from '@/hooks/use-projects';
import { ProjectCard } from '@/components/project-card';
import Link from 'next/link';

export default function HomePage() {
  const navigate = useRouter();
  const { projects, isLoading } = useProjects();
  const latestProjects = useMemo(
    () =>
      [...projects]
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        .slice(0, 5),
    [projects]
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-foreground mb-6">
            Welcome to CC Subtitles AI
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Transform your videos into professional subtitles with AI-powered
            transcription
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Button
              asChild
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              size="lg"
            >
              <Link href="/projects/new-no-workers">
                <Plus className="w-5 h-5 mr-2" />
                Create New Project
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/projects">
                <FolderOpen className="w-5 h-5 mr-2" />
                View My Projects
              </Link>
            </Button>
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          <Card>
            <CardHeader className="text-center">
              <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Upload className="w-6 h-6 text-primary" />
              </div>
              <CardTitle>Easy Upload</CardTitle>
              <CardDescription>
                Upload videos in any format and let our system handle the rest
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="text-center">
              <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Play className="w-6 h-6 text-primary" />
              </div>
              <CardTitle>AI Transcription</CardTitle>
              <CardDescription>
                Advanced AI models provide accurate speech-to-text conversion
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="text-center">
              <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center mx-auto mb-4">
                <FileText className="w-6 h-6 text-primary" />
              </div>
              <CardTitle>Professional Subtitles</CardTitle>
              <CardDescription>
                Generate timed subtitles in multiple languages with translation
                support
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Latest Projects */}
        {isLoading ? (
          <div className="text-center text-muted-foreground">
            Loading latest projects…
          </div>
        ) : latestProjects.length > 0 ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">Latest Projects</h2>
              <Button
                variant="ghost"
                onClick={() => navigate.push('/projects')}
              >
                View All
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {latestProjects.map((project) => (
                <ProjectCard
                  key={project._id}
                  project={project}
                  uploadStatus={''}
                  uploadProgress={0}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
