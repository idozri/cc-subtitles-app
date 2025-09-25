import { useEffect } from 'react';
import { useProjectStore } from '@/lib/store/project';
import { Project } from '@/types/project';

export const useProjects = () => {
  const { projects, isLoading, setLoading, setProjects, setError } =
    useProjectStore();

  const loadProjects = async () => {
    setLoading(true);
    setError(null);

    try {
      // Mock API call - replace with actual endpoint
      const response = await fetch('/api/projects');

      if (!response.ok) {
        throw new Error('Failed to load projects');
      }

      const result = await response.json();

      if (result.success) {
        setProjects(result.data || []);
      } else {
        throw new Error(result.message || 'Failed to load projects');
      }
    } catch (error) {
      console.error('Error loading projects:', error);
      setError(
        error instanceof Error ? error.message : 'Failed to load projects'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  return {
    projects,
    isLoading,
    loadProjects,
  };
};
