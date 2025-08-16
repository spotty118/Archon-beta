import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock service implementations
class MockKnowledgeService {
  async searchDocuments(query: string, filters?: any) {
    const response = await fetch('/api/knowledge/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, filters })
    })
    return response.json()
  }

  async uploadDocument(file: File, metadata?: any) {
    const formData = new FormData()
    formData.append('file', file)
    if (metadata) {
      formData.append('metadata', JSON.stringify(metadata))
    }

    const response = await fetch('/api/knowledge/upload', {
      method: 'POST',
      body: formData
    })
    return response.json()
  }

  async deleteDocument(id: string) {
    const response = await fetch(`/api/knowledge/items/${id}`, {
      method: 'DELETE'
    })
    return response.json()
  }

  async crawlWebsite(url: string, options?: any) {
    const response = await fetch('/api/knowledge/crawl', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, ...options })
    })
    return response.json()
  }

  async getDocuments(page = 1, limit = 20) {
    const response = await fetch(`/api/knowledge/items?page=${page}&limit=${limit}`)
    return response.json()
  }
}

class MockProjectService {
  async getProjects() {
    const response = await fetch('/api/projects')
    return response.json()
  }

  async createProject(data: { title: string; description?: string }) {
    const response = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    return response.json()
  }

  async updateProject(id: string, data: any) {
    const response = await fetch(`/api/projects/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    return response.json()
  }

  async deleteProject(id: string) {
    const response = await fetch(`/api/projects/${id}`, {
      method: 'DELETE'
    })
    return response.json()
  }

  async getProjectTasks(projectId: string) {
    const response = await fetch(`/api/projects/${projectId}/tasks`)
    return response.json()
  }

  async createTask(projectId: string, taskData: any) {
    const response = await fetch(`/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(taskData)
    })
    return response.json()
  }

  async updateTask(projectId: string, taskId: string, data: any) {
    const response = await fetch(`/api/projects/${projectId}/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    return response.json()
  }
}

class MockMCPService {
  async getHealth() {
    const response = await fetch('/api/mcp/health')
    return response.json()
  }

  async getTools() {
    const response = await fetch('/api/mcp/tools')
    return response.json()
  }

  async executeTool(toolName: string, params: any) {
    const response = await fetch(`/api/mcp/tools/${toolName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    })
    return response.json()
  }

  async performRAGQuery(query: string, options?: any) {
    return this.executeTool('perform_rag_query', {
      query,
      match_count: options?.matchCount || 5,
      source: options?.source
    })
  }

  async searchCodeExamples(query: string, options?: any) {
    return this.executeTool('search_code_examples', {
      query,
      match_count: options?.matchCount || 3,
      source_id: options?.sourceId
    })
  }

  async manageProject(action: string, data?: any) {
    return this.executeTool('manage_project', {
      action,
      ...data
    })
  }

  async manageTask(action: string, data?: any) {
    return this.executeTool('manage_task', {
      action,
      ...data
    })
  }
}

class MockSocketService {
  private listeners: Map<string, Function[]> = new Map()
  private connected = false

  connect() {
    this.connected = true
    setTimeout(() => {
      this.emit('connect', null)
    }, 100)
  }

  disconnect() {
    this.connected = false
    this.emit('disconnect', null)
  }

  isConnected() {
    return this.connected
  }

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event)!.push(callback)
  }

  off(event: string, callback: Function) {
    const eventListeners = this.listeners.get(event)
    if (eventListeners) {
      const index = eventListeners.indexOf(callback)
      if (index > -1) {
        eventListeners.splice(index, 1)
      }
    }
  }

  emit(event: string, data: any) {
    const eventListeners = this.listeners.get(event)
    if (eventListeners) {
      eventListeners.forEach(callback => callback(data))
    }
  }

  subscribe(channel: string, callback: Function) {
    this.on(channel, callback)
    return () => this.off(channel, callback)
  }
}

describe('API Services', () => {
  let knowledgeService: MockKnowledgeService
  let projectService: MockProjectService
  let mcpService: MockMCPService
  let socketService: MockSocketService

  beforeEach(() => {
    knowledgeService = new MockKnowledgeService()
    projectService = new MockProjectService()
    mcpService = new MockMCPService()
    socketService = new MockSocketService()
    
    vi.clearAllMocks()
    mockFetch.mockClear()
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('KnowledgeService', () => {
    test('searches documents with query', async () => {
      const mockResponse = {
        results: [
          { id: '1', title: 'Document 1', content: 'Test content' },
          { id: '2', title: 'Document 2', content: 'More content' }
        ],
        total: 2
      }

      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve(mockResponse)
      })

      const result = await knowledgeService.searchDocuments('test query')

      expect(mockFetch).toHaveBeenCalledWith('/api/knowledge/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'test query', filters: undefined })
      })

      expect(result).toEqual(mockResponse)
    })

    test('uploads document with file', async () => {
      const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' })
      const mockResponse = { id: 'upload-123', status: 'processing' }

      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve(mockResponse)
      })

      const result = await knowledgeService.uploadDocument(file, { tags: ['test'] })

      expect(mockFetch).toHaveBeenCalledWith('/api/knowledge/upload', {
        method: 'POST',
        body: expect.any(FormData)
      })

      expect(result).toEqual(mockResponse)
    })

    test('deletes document by id', async () => {
      const mockResponse = { success: true }

      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve(mockResponse)
      })

      const result = await knowledgeService.deleteDocument('doc-123')

      expect(mockFetch).toHaveBeenCalledWith('/api/knowledge/items/doc-123', {
        method: 'DELETE'
      })

      expect(result).toEqual(mockResponse)
    })

    test('crawls website with URL', async () => {
      const mockResponse = { task_id: 'crawl-123', status: 'started' }

      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve(mockResponse)
      })

      const result = await knowledgeService.crawlWebsite('https://example.com', {
        maxDepth: 2
      })

      expect(mockFetch).toHaveBeenCalledWith('/api/knowledge/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://example.com', maxDepth: 2 })
      })

      expect(result).toEqual(mockResponse)
    })

    test('gets documents with pagination', async () => {
      const mockResponse = {
        items: [{ id: '1', title: 'Doc 1' }],
        total: 50,
        page: 2,
        pages: 5
      }

      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve(mockResponse)
      })

      const result = await knowledgeService.getDocuments(2, 10)

      expect(mockFetch).toHaveBeenCalledWith('/api/knowledge/items?page=2&limit=10')
      expect(result).toEqual(mockResponse)
    })
  })

  describe('ProjectService', () => {
    test('gets all projects', async () => {
      const mockResponse = [
        { id: '1', title: 'Project 1', status: 'active' },
        { id: '2', title: 'Project 2', status: 'completed' }
      ]

      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve(mockResponse)
      })

      const result = await projectService.getProjects()

      expect(mockFetch).toHaveBeenCalledWith('/api/projects')
      expect(result).toEqual(mockResponse)
    })

    test('creates new project', async () => {
      const projectData = { title: 'New Project', description: 'Test description' }
      const mockResponse = { id: 'project-123', ...projectData, status: 'active' }

      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve(mockResponse)
      })

      const result = await projectService.createProject(projectData)

      expect(mockFetch).toHaveBeenCalledWith('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectData)
      })

      expect(result).toEqual(mockResponse)
    })

    test('updates existing project', async () => {
      const updateData = { title: 'Updated Project', status: 'completed' }
      const mockResponse = { id: 'project-123', ...updateData }

      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve(mockResponse)
      })

      const result = await projectService.updateProject('project-123', updateData)

      expect(mockFetch).toHaveBeenCalledWith('/api/projects/project-123', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      })

      expect(result).toEqual(mockResponse)
    })

    test('deletes project', async () => {
      const mockResponse = { success: true, message: 'Project deleted' }

      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve(mockResponse)
      })

      const result = await projectService.deleteProject('project-123')

      expect(mockFetch).toHaveBeenCalledWith('/api/projects/project-123', {
        method: 'DELETE'
      })

      expect(result).toEqual(mockResponse)
    })

    test('gets project tasks', async () => {
      const mockResponse = [
        { id: 'task-1', title: 'Task 1', status: 'todo' },
        { id: 'task-2', title: 'Task 2', status: 'doing' }
      ]

      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve(mockResponse)
      })

      const result = await projectService.getProjectTasks('project-123')

      expect(mockFetch).toHaveBeenCalledWith('/api/projects/project-123/tasks')
      expect(result).toEqual(mockResponse)
    })

    test('creates new task', async () => {
      const taskData = { title: 'New Task', description: 'Task description' }
      const mockResponse = { id: 'task-123', ...taskData, status: 'todo' }

      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve(mockResponse)
      })

      const result = await projectService.createTask('project-123', taskData)

      expect(mockFetch).toHaveBeenCalledWith('/api/projects/project-123/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData)
      })

      expect(result).toEqual(mockResponse)
    })

    test('updates task', async () => {
      const updateData = { status: 'done' }
      const mockResponse = { id: 'task-123', status: 'done' }

      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve(mockResponse)
      })

      const result = await projectService.updateTask('project-123', 'task-123', updateData)

      expect(mockFetch).toHaveBeenCalledWith('/api/projects/project-123/tasks/task-123', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      })

      expect(result).toEqual(mockResponse)
    })
  })

  describe('MCPService', () => {
    test('gets MCP health status', async () => {
      const mockResponse = { status: 'healthy', server_version: '1.0.0' }

      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve(mockResponse)
      })

      const result = await mcpService.getHealth()

      expect(mockFetch).toHaveBeenCalledWith('/api/mcp/health')
      expect(result).toEqual(mockResponse)
    })

    test('gets available tools', async () => {
      const mockResponse = {
        tools: [
          { name: 'perform_rag_query', description: 'Search knowledge base' },
          { name: 'manage_project', description: 'Manage projects' }
        ]
      }

      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve(mockResponse)
      })

      const result = await mcpService.getTools()

      expect(mockFetch).toHaveBeenCalledWith('/api/mcp/tools')
      expect(result).toEqual(mockResponse)
    })

    test('executes MCP tool', async () => {
      const params = { query: 'test query', match_count: 5 }
      const mockResponse = { results: ['result1', 'result2'] }

      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve(mockResponse)
      })

      const result = await mcpService.executeTool('perform_rag_query', params)

      expect(mockFetch).toHaveBeenCalledWith('/api/mcp/tools/perform_rag_query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      })

      expect(result).toEqual(mockResponse)
    })

    test('performs RAG query', async () => {
      const mockResponse = { results: ['relevant doc1', 'relevant doc2'] }

      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve(mockResponse)
      })

      const result = await mcpService.performRAGQuery('test query', { matchCount: 3 })

      expect(mockFetch).toHaveBeenCalledWith('/api/mcp/tools/perform_rag_query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'test query',
          match_count: 3,
          source: undefined
        })
      })

      expect(result).toEqual(mockResponse)
    })

    test('searches code examples', async () => {
      const mockResponse = { examples: ['example1', 'example2'] }

      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve(mockResponse)
      })

      const result = await mcpService.searchCodeExamples('React component', { sourceId: 'react-docs' })

      expect(mockFetch).toHaveBeenCalledWith('/api/mcp/tools/search_code_examples', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'React component',
          match_count: 3,
          source_id: 'react-docs'
        })
      })

      expect(result).toEqual(mockResponse)
    })

    test('manages project through MCP', async () => {
      const mockResponse = { project: { id: 'project-123', title: 'New Project' } }

      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve(mockResponse)
      })

      const result = await mcpService.manageProject('create', {
        title: 'New Project',
        description: 'Project description'
      })

      expect(mockFetch).toHaveBeenCalledWith('/api/mcp/tools/manage_project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          title: 'New Project',
          description: 'Project description'
        })
      })

      expect(result).toEqual(mockResponse)
    })

    test('manages task through MCP', async () => {
      const mockResponse = { task: { id: 'task-123', status: 'doing' } }

      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve(mockResponse)
      })

      const result = await mcpService.manageTask('update', {
        task_id: 'task-123',
        update_fields: { status: 'doing' }
      })

      expect(mockFetch).toHaveBeenCalledWith('/api/mcp/tools/manage_task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          task_id: 'task-123',
          update_fields: { status: 'doing' }
        })
      })

      expect(result).toEqual(mockResponse)
    })
  })

  describe('SocketService', () => {
    test('connects and emits connect event', (done) => {
      socketService.on('connect', () => {
        expect(socketService.isConnected()).toBe(true)
        done()
      })

      socketService.connect()
    })

    test('disconnects and emits disconnect event', (done) => {
      socketService.connect()
      
      socketService.on('disconnect', () => {
        expect(socketService.isConnected()).toBe(false)
        done()
      })

      socketService.disconnect()
    })

    test('manages event listeners correctly', () => {
      const callback1 = vi.fn()
      const callback2 = vi.fn()

      socketService.on('test_event', callback1)
      socketService.on('test_event', callback2)

      socketService.emit('test_event', { data: 'test' })

      expect(callback1).toHaveBeenCalledWith({ data: 'test' })
      expect(callback2).toHaveBeenCalledWith({ data: 'test' })
    })

    test('removes event listeners correctly', () => {
      const callback = vi.fn()

      socketService.on('test_event', callback)
      socketService.off('test_event', callback)

      socketService.emit('test_event', { data: 'test' })

      expect(callback).not.toHaveBeenCalled()
    })

    test('subscription returns unsubscribe function', () => {
      const callback = vi.fn()

      const unsubscribe = socketService.subscribe('test_channel', callback)

      socketService.emit('test_channel', { data: 'test' })
      expect(callback).toHaveBeenCalledWith({ data: 'test' })

      unsubscribe()

      socketService.emit('test_channel', { data: 'test2' })
      expect(callback).toHaveBeenCalledTimes(1) // Should not be called again
    })
  })
})