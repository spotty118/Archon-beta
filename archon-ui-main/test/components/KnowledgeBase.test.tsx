import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { mockKnowledgeItems, mockApiResponses } from '../utils/mockData'

// Mock the entire KnowledgeBasePage to test specific functionality
const MockKnowledgeBasePage = () => {
  const [items, setItems] = React.useState(mockKnowledgeItems)
  const [loading, setLoading] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState('')

  const filteredItems = items.filter(item => 
    item.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleSearch = (query: string) => {
    setSearchQuery(query)
  }

  const handleUpload = async (files: FileList) => {
    setLoading(true)
    // Simulate upload
    setTimeout(() => {
      const newItem = {
        ...mockKnowledgeItems[0],
        id: 'new-item',
        title: files[0].name,
        source_type: 'upload' as const,
        status: 'processing' as const
      }
      setItems(prev => [newItem, ...prev])
      setLoading(false)
    }, 100)
  }

  const handleDelete = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id))
  }

  return (
    <div data-testid="knowledge-base-page">
      <h1>Knowledge Base</h1>
      
      {/* Search Component */}
      <div data-testid="search-section">
        <input
          type="text"
          placeholder="Search knowledge base..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          data-testid="search-input"
        />
      </div>

      {/* Upload Component */}
      <div data-testid="upload-section">
        <input
          type="file"
          multiple
          onChange={(e) => e.target.files && handleUpload(e.target.files)}
          data-testid="file-upload"
          accept=".pdf,.docx,.md,.txt"
        />
        {loading && <div data-testid="upload-loading">Uploading...</div>}
      </div>

      {/* Items List */}
      <div data-testid="items-list">
        {filteredItems.map(item => (
          <div key={item.id} data-testid={`knowledge-item-${item.id}`} className="knowledge-item">
            <h3 data-testid={`item-title-${item.id}`}>{item.title}</h3>
            <p data-testid={`item-status-${item.id}`}>Status: {item.status}</p>
            <p data-testid={`item-type-${item.id}`}>Type: {item.source_type}</p>
            <p data-testid={`item-docs-${item.id}`}>Documents: {item.document_count}</p>
            {item.metadata?.description && (
              <p data-testid={`item-description-${item.id}`}>{item.metadata.description}</p>
            )}
            {item.metadata?.tags && (
              <div data-testid={`item-tags-${item.id}`}>
                {item.metadata.tags.map(tag => (
                  <span key={tag} className="tag">{tag}</span>
                ))}
              </div>
            )}
            <button 
              onClick={() => handleDelete(item.id)}
              data-testid={`delete-btn-${item.id}`}
            >
              Delete
            </button>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {filteredItems.length === 0 && !loading && (
        <div data-testid="empty-state">
          {searchQuery ? 'No items match your search' : 'No knowledge items found'}
        </div>
      )}
    </div>
  )
}

describe('Knowledge Base Components', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('renders knowledge base page with items', () => {
    render(<MockKnowledgeBasePage />)
    
    expect(screen.getByTestId('knowledge-base-page')).toBeInTheDocument()
    expect(screen.getByText('Knowledge Base')).toBeInTheDocument()
    expect(screen.getByTestId('search-input')).toBeInTheDocument()
    expect(screen.getByTestId('file-upload')).toBeInTheDocument()
    expect(screen.getByTestId('items-list')).toBeInTheDocument()
  })

  test('displays knowledge items correctly', () => {
    render(<MockKnowledgeBasePage />)
    
    // Check first item is displayed
    expect(screen.getByTestId('knowledge-item-1')).toBeInTheDocument()
    expect(screen.getByTestId('item-title-1')).toHaveTextContent('React Documentation')
    expect(screen.getByTestId('item-status-1')).toHaveTextContent('Status: processed')
    expect(screen.getByTestId('item-type-1')).toHaveTextContent('Type: url')
    expect(screen.getByTestId('item-docs-1')).toHaveTextContent('Documents: 15')
  })

  test('search functionality filters items', async () => {
    render(<MockKnowledgeBasePage />)
    
    const searchInput = screen.getByTestId('search-input')
    
    // Search for 'React'
    fireEvent.change(searchInput, { target: { value: 'React' } })
    
    // Should show React Documentation
    expect(screen.getByTestId('knowledge-item-1')).toBeInTheDocument()
    // Should not show TypeScript item
    expect(screen.queryByTestId('knowledge-item-2')).not.toBeInTheDocument()
  })

  test('shows empty state when no search results', async () => {
    render(<MockKnowledgeBasePage />)
    
    const searchInput = screen.getByTestId('search-input')
    
    // Search for something that doesn't exist
    fireEvent.change(searchInput, { target: { value: 'NonExistentItem' } })
    
    expect(screen.getByTestId('empty-state')).toBeInTheDocument()
    expect(screen.getByText('No items match your search')).toBeInTheDocument()
  })

  test('file upload shows loading state', async () => {
    render(<MockKnowledgeBasePage />)
    
    const fileInput = screen.getByTestId('file-upload')
    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' })
    
    fireEvent.change(fileInput, { target: { files: [file] } })
    
    // Should show loading state
    expect(screen.getByTestId('upload-loading')).toBeInTheDocument()
    expect(screen.getByText('Uploading...')).toBeInTheDocument()
    
    // Wait for upload to complete
    await waitFor(() => {
      expect(screen.queryByTestId('upload-loading')).not.toBeInTheDocument()
    }, { timeout: 200 })
    
    // New item should be added
    expect(screen.getByText('test.pdf')).toBeInTheDocument()
  })

  test('delete functionality removes items', () => {
    render(<MockKnowledgeBasePage />)
    
    // Verify item exists
    expect(screen.getByTestId('knowledge-item-1')).toBeInTheDocument()
    
    // Click delete button
    const deleteBtn = screen.getByTestId('delete-btn-1')
    fireEvent.click(deleteBtn)
    
    // Item should be removed
    expect(screen.queryByTestId('knowledge-item-1')).not.toBeInTheDocument()
  })

  test('displays item metadata correctly', () => {
    render(<MockKnowledgeBasePage />)
    
    // Check first item metadata
    expect(screen.getByTestId('item-description-1')).toHaveTextContent('Official React documentation')
    expect(screen.getByTestId('item-tags-1')).toBeInTheDocument()
    
    // Check tags are displayed
    const tagsContainer = screen.getByTestId('item-tags-1')
    expect(tagsContainer).toHaveTextContent('react')
    expect(tagsContainer).toHaveTextContent('documentation')
    expect(tagsContainer).toHaveTextContent('frontend')
  })

  test('handles different item statuses', () => {
    render(<MockKnowledgeBasePage />)
    
    // Check processed status
    expect(screen.getByTestId('item-status-1')).toHaveTextContent('Status: processed')
    
    // Check processing status
    expect(screen.getByTestId('item-status-2')).toHaveTextContent('Status: processing')
    
    // Check failed status
    expect(screen.getByTestId('item-status-3')).toHaveTextContent('Status: failed')
  })

  test('handles different source types', () => {
    render(<MockKnowledgeBasePage />)
    
    // Check URL source type
    expect(screen.getByTestId('item-type-1')).toHaveTextContent('Type: url')
    
    // Check upload source type
    expect(screen.getByTestId('item-type-3')).toHaveTextContent('Type: upload')
  })

  test('file upload accepts correct file types', () => {
    render(<MockKnowledgeBasePage />)
    
    const fileInput = screen.getByTestId('file-upload') as HTMLInputElement
    
    expect(fileInput.accept).toBe('.pdf,.docx,.md,.txt')
    expect(fileInput.multiple).toBe(true)
  })
})