import { useProjectStore } from './project';
import { Project } from '@/types/project';

// Mock project data for testing
const mockProject: Project = {
  _id: 'test-project-1',
  title: 'Test Video',
  duration: '00:05:30',
  subtitleCount: 25,
  languages: ['English'],
  createdAt: '2024-01-15T10:30:00Z',
  updatedAt: '2024-01-15T10:30:00Z',
};

describe('Project Store', () => {
  beforeEach(() => {
    // Reset store state before each test
    useProjectStore.setState({
      projects: [],
      isLoading: false,
      error: null,
    });
  });

  test('should add a project', () => {
    const { addProject } = useProjectStore.getState();

    addProject(mockProject);

    const { projects } = useProjectStore.getState();
    expect(projects).toHaveLength(1);
    expect(projects[0]).toEqual(mockProject);
  });

  test('should update a project', () => {
    const { addProject, updateProject } = useProjectStore.getState();

    addProject(mockProject);
    updateProject(mockProject._id, { title: 'Updated Title' });

    const { projects } = useProjectStore.getState();
    expect(projects[0].title).toBe('Updated Title');
  });

  test('should delete a project', () => {
    const { addProject, deleteProject } = useProjectStore.getState();

    addProject(mockProject);
    deleteProject(mockProject._id);

    const { projects } = useProjectStore.getState();
    expect(projects).toHaveLength(0);
  });

  test('should set loading state', () => {
    const { setLoading } = useProjectStore.getState();

    setLoading(true);

    const { isLoading } = useProjectStore.getState();
    expect(isLoading).toBe(true);
  });

  test('should set error state', () => {
    const { setError } = useProjectStore.getState();

    setError('Test error');

    const { error } = useProjectStore.getState();
    expect(error).toBe('Test error');
  });
});
