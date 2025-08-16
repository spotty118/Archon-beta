import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { knowledgeBaseService } from '@/services/knowledgeBaseService'
import { KnowledgeItem } from '@/types'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

const mockKnowledgeItem: KnowledgeItem = {
  id: '1',
  title: 'React Documentation',
  url: 'https://react.dev',
  source_type: 'url',
  status: 'processed',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  document_count: 15,
  metadata: {
    description: 'Official React documentation',
    tags: ['react', 'documentation']
  }
}

const mockApiResponse = {
  knowledge_items: [mockKnowledgeItem],
  total: 1,
  page: 1,
  per_page: 20
}

describe('knowledgeBaseService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getAllKnowledgeItems', () => {
    test('fetches knowledge items successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponse)
      })

      const result = await knowledgeBaseService.getAllKnowledgeItems()

      expect(mockFetch).toHaveBeenCalledWith('/api/knowledge/items')
      expect(result).toEqual(mockApiResponse)
    })

    test('handles API error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Internal server error' })
      })

      await expect(knowledgeBaseService.getAllKnowledgeItems())
        .rejects.toThrow('Failed to fetch knowledge items: 500')
    })

    test('handles network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      await expect(knowledgeBaseService.getAllKnowledgeItems())
        .rejects.toThrow('Network error')
    })

    test('includes query parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponse)
      })

      await knowledgeBaseService.getAllKnowledgeItems({ 
        page: 2, 
        per_page: 10,
        search: 'react',
        status: 'processed'
      })

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/knowledge/items?page=2&per_page=10&search=react&status=processed'
      )
    })
  })

  describe('createKnowledgeItem', () => {
    test('creates knowledge item successfully', async () => {
      const newItem = {
        title: 'Vue.js Guide',
        url: 'https://vuejs.org/guide',
        source_type: 'url' as const,
        metadata: { description: 'Vue.js official guide' }
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ knowledge_item: { ...newItem, id: '2' } })
      })

      const result = await knowledgeBaseService.createKnowledgeItem(newItem)

      expect(mockFetch).toHaveBeenCalledWith('/api/knowledge/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItem)
      })
      expect(result.knowledge_item).toEqual({ ...newItem, id: '2' })
    })

    test('validates required fields', async () => {
      const invalidItem = {
        url: 'https://example.com',
        source_type: 'url' as const
        // Missing title
      }

      await expect(knowledgeBaseService.createKnowledgeItem(invalidItem as any))
        .rejects.toThrow('Title is required')
    })

    test('validates URL format for URL sources', async () => {
      const invalidItem = {
        title: 'Invalid URL',
        url: 'not-a-url',
        source_type: 'url' as const
      }

      await expect(knowledgeBaseService.createKnowledgeItem(invalidItem))
        .rejects.toThrow('Valid URL is required for URL sources')
    })

    test('handles file upload for upload sources', async () => {
      const file = new File(['content'], 'document.pdf', { type: 'application/pdf' })
      const uploadItem = {
        title: 'PDF Document',
        source_type: 'upload' as const,
        file
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ knowledge_item: { ...uploadItem, id: '3' } })
      })

      const result = await knowledgeBaseService.createKnowledgeItem(uploadItem)

      expect(mockFetch).toHaveBeenCalledWith('/api/knowledge/items', {
        method: 'POST',
        body: expect.any(FormData)
      })
      expect(result.knowledge_item.id).toBe('3')
    })
  })

  describe('updateKnowledgeItem', () => {
    test('updates knowledge item successfully', async () => {
      const updates = {
        title: 'Updated React Documentation',
        metadata: { description: 'Updated description' }
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ 
          knowledge_item: { ...mockKnowledgeItem, ...updates } 
        })
      })

      const result = await knowledgeBaseService.updateKnowledgeItem('1', updates)

      expect(mockFetch).toHaveBeenCalledWith('/api/knowledge/items/1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })
      expect(result.knowledge_item.title).toBe('Updated React Documentation')
    })

    test('handles partial updates', async () => {
      const updates = { title: 'New Title Only' }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ 
          knowledge_item: { ...mockKnowledgeItem, ...updates } 
        })
      })

      await knowledgeBaseService.updateKnowledgeItem('1', updates)

      expect(mockFetch).toHaveBeenCalledWith('/api/knowledge/items/1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })
    })
  })

  describe('deleteKnowledgeItem', () => {
    test('deletes knowledge item successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: 'Knowledge item deleted' })
      })

      const result = await knowledgeBaseService.deleteKnowledgeItem('1')

      expect(mockFetch).toHaveBeenCalledWith('/api/knowledge/items/1', {
        method: 'DELETE'
      })
      expect(result.message).toBe('Knowledge item deleted')
    })

    test('handles delete failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Knowledge item not found' })
      })

      await expect(knowledgeBaseService.deleteKnowledgeItem('1'))
        .rejects.toThrow('Failed to delete knowledge item: 404')
    })
  })

  describe('getKnowledgeItem', () => {
    test('fetches single knowledge item successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ knowledge_item: mockKnowledgeItem })
      })

      const result = await knowledgeBaseService.getKnowledgeItem('1')

      expect(mockFetch).toHaveBeenCalledWith('/api/knowledge/items/1')
      expect(result.knowledge_item).toEqual(mockKnowledgeItem)
    })

    test('handles item not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Knowledge item not found' })
      })

      await expect(knowledgeBaseService.getKnowledgeItem('1'))
        .rejects.toThrow('Failed to fetch knowledge item: 404')
    })
  })

  describe('searchKnowledge', () => {
    test('performs knowledge search successfully', async () => {
      const searchResults = {
        results: [mockKnowledgeItem],
        total: 1,
        query: 'react hooks'
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(searchResults)
      })

      const result = await knowledgeBaseService.searchKnowledge('react hooks')

      expect(mockFetch).toHaveBeenCalledWith('/api/knowledge/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'react hooks' })
      })
      expect(result).toEqual(searchResults)
    })

    test('includes search options', async () => {
      const options = {
        limit: 10,
        source_type: 'url' as const,
        status: 'processed' as const
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ results: [], total: 0 })
      })

      await knowledgeBaseService.searchKnowledge('react', options)

      expect(mockFetch).toHaveBeenCalledWith('/api/knowledge/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'react', ...options })
      })
    })

    test('handles empty search query', async () => {
      await expect(knowledgeBaseService.searchKnowledge(''))
        .rejects.toThrow('Search query cannot be empty')
    })
  })

  describe('getDocuments', () => {
    test('fetches documents for knowledge item', async () => {
      const documents = [
        {
          id: '1',
          title: 'Introduction to React',
          content: 'React is a JavaScript library...',
          chunk_number: 1,
          metadata: {}
        }
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ documents })
      })

      const result = await knowledgeBaseService.getDocuments('1')

      expect(mockFetch).toHaveBeenCalledWith('/api/knowledge/items/1/documents')
      expect(result.documents).toEqual(documents)
    })

    test('includes pagination parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ documents: [], total: 0 })
      })

      await knowledgeBaseService.getDocuments('1', { page: 2, per_page: 10 })

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/knowledge/items/1/documents?page=2&per_page=10'
      )
    })
  })

  describe('refreshKnowledgeItem', () => {
    test('refreshes knowledge item successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ 
          message: 'Refresh started',
          job_id: 'job-123'
        })
      })

      const result = await knowledgeBaseService.refreshKnowledgeItem('1')

      expect(mockFetch).toHaveBeenCalledWith('/api/knowledge/items/1/refresh', {
        method: 'POST'
      })
      expect(result.job_id).toBe('job-123')
    })

    test('handles refresh failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: () => Promise.resolve({ error: 'Refresh already in progress' })
      })

      await expect(knowledgeBaseService.refreshKnowledgeItem('1'))
        .rejects.toThrow('Failed to refresh knowledge item: 409')
    })
  })

  describe('bulkOperations', () => {
    test('performs bulk delete successfully', async () => {
      const itemIds = ['1', '2', '3']

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ 
          message: 'Bulk delete completed',
          deleted_count: 3
        })
      })

      const result = await knowledgeBaseService.bulkDelete(itemIds)

      expect(mockFetch).toHaveBeenCalledWith('/api/knowledge/items/bulk/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_ids: itemIds })
      })
      expect(result.deleted_count).toBe(3)
    })

    test('performs bulk status update successfully', async () => {
      const itemIds = ['1', '2']
      const status = 'archived'

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ 
          message: 'Bulk update completed',
          updated_count: 2
        })
      })

      const result = await knowledgeBaseService.bulkUpdateStatus(itemIds, status)

      expect(mockFetch).toHaveBeenCalledWith('/api/knowledge/items/bulk/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_ids: itemIds, status })
      })
      expect(result.updated_count).toBe(2)
    })
  })

  describe('error handling', () => {
    test('handles malformed JSON response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON'))
      })

      await expect(knowledgeBaseService.getAllKnowledgeItems())
        .rejects.toThrow('Invalid JSON')
    })

    test('handles timeout errors', async () => {
      vi.useFakeTimers()
      
      // Mock a hanging request
      mockFetch.mockImplementationOnce(() => 
        new Promise((resolve) => {
          setTimeout(() => resolve({
            ok: true,
            json: () => Promise.resolve({})
          }), 10000)
        })
      )

      const promise = knowledgeBaseService.getAllKnowledgeItems()
      
      // Fast-forward time
      vi.advanceTimersByTime(10000)
      
      await expect(promise).rejects.toThrow()
      
      vi.useRealTimers()
    })

    test('provides detailed error information', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        statusText: 'Unprocessable Entity',
        json: () => Promise.resolve({ 
          error: 'Validation failed',
          details: { title: 'Title is required' }
        })
      })

      try {
        await knowledgeBaseService.createKnowledgeItem({
          title: '',
          url: 'https://example.com',
          source_type: 'url'
        })
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect(error.message).toContain('422')
        expect(error.details).toEqual({ title: 'Title is required' })
      }
    })
  })

  describe('caching', () => {
    test('caches knowledge items list', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockApiResponse)
      })

      // First call
      await knowledgeBaseService.getAllKnowledgeItems()
      
      // Second call should use cache
      await knowledgeBaseService.getAllKnowledgeItems()

      // Should only make one API call due to caching
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    test('invalidates cache on mutations', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockApiResponse)
      })

      // Populate cache
      await knowledgeBaseService.getAllKnowledgeItems()
      expect(mockFetch).toHaveBeenCalledTimes(1)

      // Perform mutation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ knowledge_item: mockKnowledgeItem })
      })
      
      await knowledgeBaseService.createKnowledgeItem({
        title: 'New Item',
        url: 'https://example.com',
        source_type: 'url'
      })

      // Next read should refetch
      await knowledgeBaseService.getAllKnowledgeItems()
      
      expect(mockFetch).toHaveBeenCalledTimes(3) // initial + create + refetch
    })
  })
})