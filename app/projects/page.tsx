'use client';

import { useEffect, useState } from 'react';
import { useProjectStore } from '@/lib/store/project';
// Worker functionality removed
import { ProjectCard } from '@/components/project-card';
import { Button } from '@/components/ui/button';
import { Plus, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

export default function ProjectsPage() {
  const { projects, isLoading, error, fetchProjects, deleteProject } =
    useProjectStore();
  // Worker functionality removed
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchProjects();
      toast({
        title: 'Projects Refreshed',
        description: 'Your projects list has been updated.',
      });
    } catch (error) {
      toast({
        title: 'Refresh Failed',
        description: 'Failed to refresh projects. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setRefreshing(false);
    }
  };

  const handleCreateNew = () => {
    router.push('/projects/new');
  };

  const handleCancelProject = async (projectId: string) => {
    try {
      // Delete project from backend
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete project');
      }

      // Remove project from local store
      deleteProject(projectId);

      toast({
        title: 'Project Cancelled',
        description: 'The project has been cancelled and deleted successfully.',
      });
    } catch (error) {
      console.error('Failed to cancel project:', error);
      toast({
        title: 'Cancellation Failed',
        description: 'Failed to cancel the project. Please try again.',
        variant: 'destructive',
      });
      throw error; // Re-throw to let the component handle it
    }
  };

  if (isLoading && projects.length === 0) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">My Projects</h1>
          <p className="text-muted-foreground mt-2">
            Manage your video projects and track upload progress
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2"
          >
            <RefreshCw
              className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>
          <Button onClick={handleCreateNew} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Project
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-6">
          <p className="text-destructive text-sm">
            Error loading projects: {error}
          </p>
        </div>
      )}

      {projects.length === 0 && !isLoading ? (
        <div className="text-center py-16">
          <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
            <Plus className="w-12 h-12 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-semibold mb-2">No projects yet</h3>
          <p className="text-muted-foreground mb-6">
            Get started by creating your first video project
          </p>
          <Button onClick={handleCreateNew} size="lg">
            Create Your First Project
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <ProjectCard
              key={project._id}
              project={project}
              uploadStatus={project.status}
              uploadProgress={0}
              onCancelProject={handleCancelProject}
            />
          ))}
        </div>
      )}
    </div>
  );
}
