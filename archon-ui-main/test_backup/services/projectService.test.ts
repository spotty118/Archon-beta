import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Project, Task } from '@/types/project'
import { projectService } from '@/services/projectService'

// Mock fetch globally
global.fetch = vi.fn()

// Mock console.error to avoid noise in tests
const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

const mockProject: Project = {
  id: 'test-project-id',
  title: 'Test Project',
  description: 'A test project',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  github_repo: 'https://github.com/test/repo',
  pinned: false,
  prd: {
    product_vision: 'Test vision',
    target_users: ['Test users'],
    key_features: ['Test feature'],
    success_metrics: ['Test metric'],
    constraints: ['Test constraint']
  }
}

const mockTask: Task = {
  id: 'test-task-id',
  project_id: 'test-project-id',
  title: 'Test Task',
  description: 'A test task',
  status: 'todo',
  assignee: 'User',
  task_order: 1,
  feature: 'test-feature',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
}

describe('Project Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    consoleSpy.mockClear()
  })

  describe('listProjects', () => {
    it('should fetch and return projects', async () => {
      const mockResponse = [mockProject]
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      const result = await projectService.listProjects()

      expect(fetch).toHaveBeenCalledWith('/api/projects')
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe(mockProject.id)
    })

    it('should handle fetch errors', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

      await expect(projectService.listProjects()).rejects.toThrow()
    })
  })

  describe('getProject', () => {
    it('should fetch and return a specific project', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockProject,
      } as Response)

      const result = await projectService.getProject('test-project-id')

      expect(fetch).toHaveBeenCalledWith('/api/projects/test-project-id')
      expect(result.id).toBe(mockProject.id)
    })

    it('should handle errors when fetching a project', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

      await expect(projectService.getProject('test-project-id')).rejects.toThrow()
    })
  })

  describe('createProject', () => {
    const newProject = {
      title: 'New Project',
      description: 'A new project',
      github_repo: 'https://github.com/test/new-repo'
    }

    it('should create a new project', async () => {
      const createdProject = { ...mockProject, ...newProject }
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => createdProject,
      } as Response)

      const result = await projectService.createProject(newProject)

      expect(fetch).toHaveBeenCalledWith('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProject),
      })
      expect(result.title).toBe(newProject.title)
    })

    it('should handle errors when creating a project', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

      await expect(projectService.createProject(newProject)).rejects.toThrow()
    })
  })

  describe('updateProject', () => {
    const updates = { title: 'Updated Project' }

    it('should update a project', async () => {
      const updatedProject = { ...mockProject, ...updates }
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => updatedProject,
      } as Response)

      const result = await projectService.updateProject('test-project-id', updates)

      expect(fetch).toHaveBeenCalledWith('/api/projects/test-project-id', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      expect(result.title).toBe(updates.title)
    })

    it('should handle errors when updating a project', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

      await expect(projectService.updateProject('test-project-id', updates)).rejects.toThrow()
    })
  })

  describe('deleteProject', () => {
    it('should delete a project', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response)

      await projectService.deleteProject('test-project-id')

      expect(fetch).toHaveBeenCalledWith('/api/projects/test-project-id', {
        method: 'DELETE',
      })
    })

    it('should handle errors when deleting a project', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

      await expect(projectService.deleteProject('test-project-id')).rejects.toThrow()
    })
  })

  describe('getTasksByProject', () => {
    it('should fetch and return tasks for a project', async () => {
      const mockResponse = [mockTask]
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      const result = await projectService.getTasksByProject('test-project-id')

      expect(fetch).toHaveBeenCalledWith('/api/projects/test-project-id/tasks')
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe(mockTask.id)
    })

    it('should handle errors when fetching tasks', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

      await expect(projectService.getTasksByProject('test-project-id')).rejects.toThrow()
    })
  })

  describe('createTask', () => {
    const newTask = {
      project_id: 'test-project-id',
      title: 'New Task',
      description: 'A new task',
      status: 'todo' as const,
      assignee: 'User' as const,
      task_order: 2,
      feature: 'new-feature'
    }

    it('should create a new task', async () => {
      const createdTask = { ...mockTask, ...newTask }
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => createdTask,
      } as Response)

      const result = await projectService.createTask(newTask)

      expect(fetch).toHaveBeenCalledWith('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTask),
      })
      expect(result.title).toBe(newTask.title)
    })

    it('should handle errors when creating a task', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

      await expect(projectService.createTask(newTask)).rejects.toThrow()
    })
  })

  describe('updateTask', () => {
    const updates = { status: 'doing' as const }

    it('should update a task', async () => {
      const updatedTask = { ...mockTask, ...updates }
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => updatedTask,
      } as Response)

      const result = await projectService.updateTask('test-task-id', updates)

      expect(fetch).toHaveBeenCalledWith('/api/tasks/test-task-id', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      expect(result.status).toBe(updates.status)
    })

    it('should handle errors when updating a task', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

      await expect(projectService.updateTask('test-task-id', updates)).rejects.toThrow()
    })
  })

  describe('deleteTask', () => {
    it('should delete a task', async () => {
      // Mock getTask call first (needed for broadcasting)
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockTask,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        } as Response)

      await projectService.deleteTask('test-task-id')

      expect(fetch).toHaveBeenCalledWith('/api/tasks/test-task-id')
      expect(fetch).toHaveBeenCalledWith('/api/tasks/test-task-id', {
        method: 'DELETE',
      })
    })

    it('should handle errors when deleting a task', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

      await expect(projectService.deleteTask('test-task-id')).rejects.toThrow()
    })
  })
})
