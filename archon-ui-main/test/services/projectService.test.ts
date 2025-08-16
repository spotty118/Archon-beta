import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { projectService } from '@/services/projectService'
import { Project, Task } from '@/types'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

const mockProject: Project = {
  id: 'project-1',
  title: 'React Dashboard',
  description: 'A modern React dashboard application',
  status: 'active',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  metadata: {
    github_repo: 'https://github.com/user/react-dashboard',
    tech_stack: ['React', 'TypeScript', 'Vite'],
    tags: ['frontend', 'dashboard']
  },
  task_count: 5,
  document_count: 3,
  progress: 60
}

const mockTask: Task = {
  id: 'task-1',
  title: 'Implement authentication',
  description: 'Add OAuth2 authentication',
  status: 'todo',
  priority: 'high',
  assignee: 'AI IDE Agent',
  task_order: 1,
  feature: 'auth',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  project_id: 'project-1'
}

describe('projectService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getAllProjects', () => {
    test('fetches projects successfully', async () => {
      const mockResponse = {
        projects: [mockProject],
        total: 1,
        page: 1,
        per_page: 20
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      })

      const result = await projectService.getAllProjects()

      expect(mockFetch).toHaveBeenCalledWith('/api/projects')
      expect(result).toEqual(mockResponse)
    })

    test('includes query parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ projects: [], total: 0 })
      })

      await projectService.getAllProjects({ 
        page: 2, 
        per_page: 10,
        status: 'active',
        search: 'react'
      })

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/projects?page=2&per_page=10&status=active&search=react'
      )
    })

    test('handles API error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Internal server error' })
      })

      await expect(projectService.getAllProjects())
        .rejects.toThrow('Failed to fetch projects: 500')
    })
  })

  describe('createProject', () => {
    test('creates project successfully', async () => {
      const newProject = {
        title: 'Vue.js App',
        description: 'A new Vue.js application',
        metadata: {
          tech_stack: ['Vue.js', 'TypeScript']
        }
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ 
          project: { ...newProject, id: 'project-2' }
        })
      })

      const result = await projectService.createProject(newProject)

      expect(mockFetch).toHaveBeenCalledWith('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProject)
      })
      expect(result.project.id).toBe('project-2')
    })

    test('validates required fields', async () => {
      const invalidProject = {
        description: 'Missing title'
        // Missing title
      }

      await expect(projectService.createProject(invalidProject as any))
        .rejects.toThrow('Title is required')
    })

    test('validates GitHub repository URL format', async () => {
      const invalidProject = {
        title: 'Test Project',
        metadata: {
          github_repo: 'not-a-valid-url'
        }
      }

      await expect(projectService.createProject(invalidProject))
        .rejects.toThrow('Invalid GitHub repository URL')
    })

    test('handles creation with minimal data', async () => {
      const minimalProject = {
        title: 'Minimal Project'
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ 
          project: { ...minimalProject, id: 'project-3' }
        })
      })

      const result = await projectService.createProject(minimalProject)
      
      expect(result.project.title).toBe('Minimal Project')
    })
  })

  describe('updateProject', () => {
    test('updates project successfully', async () => {
      const updates = {
        title: 'Updated React Dashboard',
        description: 'Updated description',
        status: 'archived' as const
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ 
          project: { ...mockProject, ...updates }
        })
      })

      const result = await projectService.updateProject('project-1', updates)

      expect(mockFetch).toHaveBeenCalledWith('/api/projects/project-1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })
      expect(result.project.title).toBe('Updated React Dashboard')
      expect(result.project.status).toBe('archived')
    })

    test('handles partial updates', async () => {
      const updates = { status: 'completed' as const }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ 
          project: { ...mockProject, ...updates }
        })
      })

      await projectService.updateProject('project-1', updates)

      expect(mockFetch).toHaveBeenCalledWith('/api/projects/project-1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })
    })

    test('validates GitHub URL in updates', async () => {
      const updates = {
        metadata: {
          github_repo: 'invalid-url'
        }
      }

      await expect(projectService.updateProject('project-1', updates))
        .rejects.toThrow('Invalid GitHub repository URL')
    })
  })

  describe('deleteProject', () => {
    test('deletes project successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: 'Project deleted' })
      })

      const result = await projectService.deleteProject('project-1')

      expect(mockFetch).toHaveBeenCalledWith('/api/projects/project-1', {
        method: 'DELETE'
      })
      expect(result.message).toBe('Project deleted')
    })

    test('handles delete failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Project not found' })
      })

      await expect(projectService.deleteProject('project-1'))
        .rejects.toThrow('Failed to delete project: 404')
    })
  })

  describe('getProject', () => {
    test('fetches single project successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ project: mockProject })
      })

      const result = await projectService.getProject('project-1')

      expect(mockFetch).toHaveBeenCalledWith('/api/projects/project-1')
      expect(result.project).toEqual(mockProject)
    })

    test('includes tasks and documents in response', async () => {
      const fullProject = {
        project: mockProject,
        tasks: [mockTask],
        documents: [
          { id: 'doc-1', title: 'README', type: 'markdown' }
        ]
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(fullProject)
      })

      const result = await projectService.getProject('project-1', { include: 'tasks,documents' })

      expect(mockFetch).toHaveBeenCalledWith('/api/projects/project-1?include=tasks,documents')
      expect(result.tasks).toHaveLength(1)
      expect(result.documents).toHaveLength(1)
    })
  })

  describe('getProjectTasks', () => {
    test('fetches project tasks successfully', async () => {
      const tasksResponse = {
        tasks: [mockTask],
        total: 1,
        page: 1,
        per_page: 20
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(tasksResponse)
      })

      const result = await projectService.getProjectTasks('project-1')

      expect(mockFetch).toHaveBeenCalledWith('/api/projects/project-1/tasks')
      expect(result).toEqual(tasksResponse)
    })

    test('includes task filtering parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ tasks: [], total: 0 })
      })

      await projectService.getProjectTasks('project-1', {
        status: 'todo',
        assignee: 'AI IDE Agent',
        priority: 'high'
      })

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/projects/project-1/tasks?status=todo&assignee=AI%20IDE%20Agent&priority=high'
      )
    })
  })

  describe('createTask', () => {
    test('creates task successfully', async () => {
      const newTask = {
        title: 'Setup database',
        description: 'Configure PostgreSQL database',
        priority: 'medium' as const,
        assignee: 'User',
        feature: 'database'
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ 
          task: { ...newTask, id: 'task-2', project_id: 'project-1' }
        })
      })

      const result = await projectService.createTask('project-1', newTask)

      expect(mockFetch).toHaveBeenCalledWith('/api/projects/project-1/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTask)
      })
      expect(result.task.project_id).toBe('project-1')
    })

    test('validates task order is positive', async () => {
      const invalidTask = {
        title: 'Invalid Task',
        task_order: -1
      }

      await expect(projectService.createTask('project-1', invalidTask as any))
        .rejects.toThrow('Task order must be positive')
    })
  })

  describe('updateTask', () => {
    test('updates task successfully', async () => {
      const updates = {
        status: 'doing' as const,
        priority: 'low' as const
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ 
          task: { ...mockTask, ...updates }
        })
      })

      const result = await projectService.updateTask('project-1', 'task-1', updates)

      expect(mockFetch).toHaveBeenCalledWith('/api/projects/project-1/tasks/task-1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })
      expect(result.task.status).toBe('doing')
    })
  })

  describe('deleteTask', () => {
    test('deletes task successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: 'Task deleted' })
      })

      const result = await projectService.deleteTask('project-1', 'task-1')

      expect(mockFetch).toHaveBeenCalledWith('/api/projects/project-1/tasks/task-1', {
        method: 'DELETE'
      })
      expect(result.message).toBe('Task deleted')
    })
  })

  describe('getProjectStatistics', () => {
    test('fetches project statistics successfully', async () => {
      const stats = {
        total_projects: 10,
        active_projects: 7,
        completed_projects: 2,
        archived_projects: 1,
        total_tasks: 50,
        completed_tasks: 30,
        avg_completion_time: 7.5
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(stats)
      })

      const result = await projectService.getProjectStatistics()

      expect(mockFetch).toHaveBeenCalledWith('/api/projects/statistics')
      expect(result).toEqual(stats)
    })
  })

  describe('searchProjects', () => {
    test('searches projects successfully', async () => {
      const searchResults = {
        projects: [mockProject],
        total: 1,
        query: 'react dashboard'
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(searchResults)
      })

      const result = await projectService.searchProjects('react dashboard')

      expect(mockFetch).toHaveBeenCalledWith('/api/projects/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'react dashboard' })
      })
      expect(result).toEqual(searchResults)
    })

    test('includes search filters', async () => {
      const filters = {
        status: 'active' as const,
        tech_stack: ['React', 'TypeScript']
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ projects: [], total: 0 })
      })

      await projectService.searchProjects('react', filters)

      expect(mockFetch).toHaveBeenCalledWith('/api/projects/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'react', ...filters })
      })
    })
  })

  describe('archiveProject', () => {
    test('archives project successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ 
          project: { ...mockProject, status: 'archived' }
        })
      })

      const result = await projectService.archiveProject('project-1')

      expect(mockFetch).toHaveBeenCalledWith('/api/projects/project-1/archive', {
        method: 'POST'
      })
      expect(result.project.status).toBe('archived')
    })
  })

  describe('restoreProject', () => {
    test('restores archived project successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ 
          project: { ...mockProject, status: 'active' }
        })
      })

      const result = await projectService.restoreProject('project-1')

      expect(mockFetch).toHaveBeenCalledWith('/api/projects/project-1/restore', {
        method: 'POST'
      })
      expect(result.project.status).toBe('active')
    })
  })

  describe('duplicateProject', () => {
    test('duplicates project successfully', async () => {
      const duplicatedProject = {
        ...mockProject,
        id: 'project-copy',
        title: 'React Dashboard (Copy)'
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ project: duplicatedProject })
      })

      const result = await projectService.duplicateProject('project-1')

      expect(mockFetch).toHaveBeenCalledWith('/api/projects/project-1/duplicate', {
        method: 'POST'
      })
      expect(result.project.title).toContain('(Copy)')
    })

    test('includes duplication options', async () => {
      const options = {
        include_tasks: true,
        include_documents: false,
        new_title: 'Custom Copy Title'
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ project: mockProject })
      })

      await projectService.duplicateProject('project-1', options)

      expect(mockFetch).toHaveBeenCalledWith('/api/projects/project-1/duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options)
      })
    })
  })

  describe('error handling', () => {
    test('provides detailed validation errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: () => Promise.resolve({
          error: 'Validation failed',
          details: {
            title: 'Title is required',
            github_repo: 'Invalid URL format'
          }
        })
      })

      try {
        await projectService.createProject({
          title: '',
          metadata: { github_repo: 'invalid-url' }
        })
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect(error.details).toEqual({
          title: 'Title is required',
          github_repo: 'Invalid URL format'
        })
      }
    })

    test('handles network timeouts', async () => {
      vi.useFakeTimers()
      
      mockFetch.mockImplementationOnce(() => 
        new Promise((resolve) => {
          setTimeout(() => resolve({
            ok: true,
            json: () => Promise.resolve({})
          }), 30000)
        })
      )

      const promise = projectService.getAllProjects()
      
      vi.advanceTimersByTime(30000)
      
      await expect(promise).rejects.toThrow()
      
      vi.useRealTimers()
    })
  })

  describe('bulk operations', () => {
    test('performs bulk archive successfully', async () => {
      const projectIds = ['project-1', 'project-2', 'project-3']

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          message: 'Bulk archive completed',
          archived_count: 3
        })
      })

      const result = await projectService.bulkArchive(projectIds)

      expect(mockFetch).toHaveBeenCalledWith('/api/projects/bulk/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_ids: projectIds })
      })
      expect(result.archived_count).toBe(3)
    })

    test('performs bulk delete successfully', async () => {
      const projectIds = ['project-1', 'project-2']

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          message: 'Bulk delete completed',
          deleted_count: 2
        })
      })

      const result = await projectService.bulkDelete(projectIds)

      expect(mockFetch).toHaveBeenCalledWith('/api/projects/bulk/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_ids: projectIds })
      })
      expect(result.deleted_count).toBe(2)
    })
  })
})