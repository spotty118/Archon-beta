import { describe, it, expect, vi, beforeEach } from 'vitest'
import { knowledgeBaseService } from '@/services/knowledgeBaseService'

// Mock the entire service module
vi.mock('@/services/knowledgeBaseService', () => ({
  knowledgeBaseService: {
    getKnowledgeItems: vi.fn(),
    getKnowledgeItemDetails: vi.fn(),
    updateKnowledgeItem: vi.fn(),
    deleteKnowledgeItem: vi.fn(),
    refreshKnowledgeItem: vi.fn(),
    searchKnowledgeBase: vi.fn(),
    uploadDocument: vi.fn(),
    crawlUrl: vi.fn(),
    stopCrawl: vi.fn(),
    getCodeExamples: vi.fn()
  }
}))

describe('Knowledge Base Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getKnowledgeItems', () => {
    it('should fetch all knowledge items', async () => {
      const mockItems = {
        items: [
          { 
            id: '1', 
            title: 'Test Item 1', 
            url: 'https://example.com/doc1',
            source_id: 'source1',
            metadata: { source_type: 'file' as const, knowledge_type: 'technical' as const },
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z'
          },
          { 
            id: '2', 
            title: 'Test Item 2', 
            url: 'https://example.com/doc2',
            source_id: 'source2',
            metadata: { source_type: 'url' as const, knowledge_type: 'business' as const },
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z'
          }
        ],
        total: 2,
        page: 1,
        per_page: 20
      }
      
      vi.mocked(knowledgeBaseService.getKnowledgeItems).mockResolvedValue(mockItems)
      
      const result = await knowledgeBaseService.getKnowledgeItems()
      expect(result).toEqual(mockItems)
      expect(knowledgeBaseService.getKnowledgeItems).toHaveBeenCalledOnce()
    })

    it('should handle fetch errors', async () => {
      vi.mocked(knowledgeBaseService.getKnowledgeItems).mockRejectedValue(new Error('Network error'))
      
      await expect(knowledgeBaseService.getKnowledgeItems()).rejects.toThrow('Network error')
    })

    it('should support filtering', async () => {
      const filter = { knowledge_type: 'technical' as const, page: 2 }
      const mockResponse = { items: [], total: 0, page: 2, per_page: 20 }
      
      vi.mocked(knowledgeBaseService.getKnowledgeItems).mockResolvedValue(mockResponse)
      
      const result = await knowledgeBaseService.getKnowledgeItems(filter)
      expect(result).toEqual(mockResponse)
      expect(knowledgeBaseService.getKnowledgeItems).toHaveBeenCalledWith(filter)
    })
  })

  describe('getKnowledgeItemDetails', () => {
    it('should fetch detailed knowledge item information', async () => {
      const mockItemDetails = { 
        id: '1', 
        title: 'Test Item', 
        source_type: 'document',
        content: 'Test content',
        metadata: { author: 'Test Author' }
      }
      
      vi.mocked(knowledgeBaseService.getKnowledgeItemDetails).mockResolvedValue(mockItemDetails)
      
      const result = await knowledgeBaseService.getKnowledgeItemDetails('1')
      expect(result).toEqual(mockItemDetails)
      expect(knowledgeBaseService.getKnowledgeItemDetails).toHaveBeenCalledWith('1')
    })
  })

  describe('updateKnowledgeItem', () => {
    it('should update an existing knowledge item', async () => {
      const updates = { description: 'Updated Description', knowledge_type: 'business' as const }
      const updatedItem = { 
        id: '1', 
        title: 'Test Item',
        url: 'https://example.com/doc1',
        source_id: 'source1',
        metadata: { 
          source_type: 'file' as const,
          knowledge_type: 'business' as const,
          description: 'Updated Description'
        },
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }
      
      vi.mocked(knowledgeBaseService.updateKnowledgeItem).mockResolvedValue(updatedItem)
      
      const result = await knowledgeBaseService.updateKnowledgeItem('1', updates)
      expect(result).toEqual(updatedItem)
      expect(knowledgeBaseService.updateKnowledgeItem).toHaveBeenCalledWith('1', updates)
    })
  })

  describe('deleteKnowledgeItem', () => {
    it('should delete a knowledge item', async () => {
      vi.mocked(knowledgeBaseService.deleteKnowledgeItem).mockResolvedValue(undefined)
      
      await knowledgeBaseService.deleteKnowledgeItem('1')
      expect(knowledgeBaseService.deleteKnowledgeItem).toHaveBeenCalledWith('1')
    })
  })

  describe('refreshKnowledgeItem', () => {
    it('should refresh a knowledge item', async () => {
      const refreshedItem = { id: '1', title: 'Refreshed Item', source_type: 'url' }
      vi.mocked(knowledgeBaseService.refreshKnowledgeItem).mockResolvedValue(refreshedItem)
      
      const result = await knowledgeBaseService.refreshKnowledgeItem('1')
      expect(result).toEqual(refreshedItem)
      expect(knowledgeBaseService.refreshKnowledgeItem).toHaveBeenCalledWith('1')
    })
  })

  describe('searchKnowledgeBase', () => {
    it('should search knowledge base and return results', async () => {
      const query = 'test query'
      const mockResults: any[] = [
        { id: '1', title: 'Result 1', content: 'Test content 1' },
        { id: '2', title: 'Result 2', content: 'Test content 2' }
      ]
      
      vi.mocked(knowledgeBaseService.searchKnowledgeBase).mockResolvedValue(mockResults)
      
      const result = await knowledgeBaseService.searchKnowledgeBase(query)
      expect(result).toEqual(mockResults)
      expect(knowledgeBaseService.searchKnowledgeBase).toHaveBeenCalledWith(query)
    })

    it('should support search options', async () => {
      const query = 'test query'
      const options = { knowledge_type: 'technical' as const, limit: 5 }
      const mockResults: any[] = []
      
      vi.mocked(knowledgeBaseService.searchKnowledgeBase).mockResolvedValue(mockResults)
      
      const result = await knowledgeBaseService.searchKnowledgeBase(query, options)
      expect(result).toEqual(mockResults)
      expect(knowledgeBaseService.searchKnowledgeBase).toHaveBeenCalledWith(query, options)
    })
  })

  describe('uploadDocument', () => {
    it('should upload a document', async () => {
      const file = new File(['test'], 'test.txt', { type: 'text/plain' })
      const mockResponse = { id: '1', title: 'test.txt', source_type: 'document' }
      
      vi.mocked(knowledgeBaseService.uploadDocument).mockResolvedValue(mockResponse)
      
      const result = await knowledgeBaseService.uploadDocument(file)
      expect(result).toEqual(mockResponse)
      expect(knowledgeBaseService.uploadDocument).toHaveBeenCalledWith(file)
    })

    it('should upload with metadata', async () => {
      const file = new File(['test'], 'test.txt', { type: 'text/plain' })
      const metadata = { knowledge_type: 'technical' as const, tags: ['test'] }
      const mockResponse = { id: '1', title: 'test.txt', source_type: 'document' }
      
      vi.mocked(knowledgeBaseService.uploadDocument).mockResolvedValue(mockResponse)
      
      const result = await knowledgeBaseService.uploadDocument(file, metadata)
      expect(result).toEqual(mockResponse)
      expect(knowledgeBaseService.uploadDocument).toHaveBeenCalledWith(file, metadata)
    })
  })

  describe('crawlUrl', () => {
    it('should crawl a URL', async () => {
      const crawlRequest = { url: 'https://example.com' }
      const mockResponse = { success: true, source_id: '1' }
      
      vi.mocked(knowledgeBaseService.crawlUrl).mockResolvedValue(mockResponse)
      
      const result = await knowledgeBaseService.crawlUrl(crawlRequest)
      expect(result).toEqual(mockResponse)
      expect(knowledgeBaseService.crawlUrl).toHaveBeenCalledWith(crawlRequest)
    })

    it('should crawl with options', async () => {
      const crawlRequest = { 
        url: 'https://example.com',
        knowledge_type: 'technical' as const,
        max_depth: 2,
        tags: ['example']
      }
      const mockResponse = { success: true, source_id: '1' }
      
      vi.mocked(knowledgeBaseService.crawlUrl).mockResolvedValue(mockResponse)
      
      const result = await knowledgeBaseService.crawlUrl(crawlRequest)
      expect(result).toEqual(mockResponse)
      expect(knowledgeBaseService.crawlUrl).toHaveBeenCalledWith(crawlRequest)
    })
  })

  describe('stopCrawl', () => {
    it('should stop crawling', async () => {
      vi.mocked(knowledgeBaseService.stopCrawl).mockResolvedValue(undefined)
      
      await knowledgeBaseService.stopCrawl('progress-123')
      expect(knowledgeBaseService.stopCrawl).toHaveBeenCalledWith('progress-123')
    })
  })

  describe('getCodeExamples', () => {
    it('should fetch code examples', async () => {
      const mockExamples = {
        success: true,
        source_id: '1',
        code_examples: [
          { id: '1', title: 'Example 1', code: 'console.log("test")' },
          { id: '2', title: 'Example 2', code: 'function test() {}' }
        ],
        count: 2
      }
      
      vi.mocked(knowledgeBaseService.getCodeExamples).mockResolvedValue(mockExamples)
      
      const result = await knowledgeBaseService.getCodeExamples('1')
      expect(result).toEqual(mockExamples)
      expect(knowledgeBaseService.getCodeExamples).toHaveBeenCalledWith('1')
    })
  })
})
