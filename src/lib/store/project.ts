import { create } from 'zustand';
import { Project, ProjectStatus } from '@/types/project';

interface ProjectState {
  projects: Project[];
  isLoading: boolean;
  error: string | null;
  addProject: (project: Project) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  setProjects: (projects: Project[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  fetchProjects: () => Promise<void>;
  updateProjectStatus: (id: string, status: ProjectStatus) => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  isLoading: true,
  error: null,

  addProject: (project) =>
    set((state) => ({
      projects: [...state.projects, project],
      error: null,
    })),

  updateProject: (id, updates) =>
    set((state) => ({
      projects: state.projects.map((project) =>
        project._id === id ? { ...project, ...updates } : project
      ),
      error: null,
    })),

  deleteProject: (id) =>
    set((state) => ({
      projects: state.projects.filter((project) => project._id !== id),
      error: null,
    })),

  setProjects: (projects) => set({ projects, error: null }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  clearError: () => set({ error: null }),

  fetchProjects: async () => {
    try {
      set({ isLoading: true, error: null });

      // Import device ID utility
      const { getDeviceId } = await import('@/lib/device-id');
      const deviceId = getDeviceId();

      const response = await fetch('/api/projects', {
        credentials: 'include',
        headers: {
          'X-Device-ID': deviceId,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch projects');
      }

      const data = await response.json();

      if (data.success) {
        set({ projects: data.data, error: null });
      } else {
        throw new Error(data.message || 'Failed to fetch projects');
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      set({ error: errorMessage });
    } finally {
      set({ isLoading: false });
    }
  },

  updateProjectStatus: async (id, status) => {
    // Update local state immediately
    get().updateProject(id, { status });

    // Also update the backend
    try {
      const response = await fetch('/api/projects', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          id,
          status,
        }),
      });

      if (!response.ok) {
        console.error('Failed to update project status on backend');
      }
    } catch (error) {
      console.error('Error updating project status on backend:', error);
    }
  },
}));
