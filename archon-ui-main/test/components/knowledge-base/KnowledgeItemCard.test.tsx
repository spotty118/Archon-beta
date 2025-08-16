/**
 * Comprehensive tests for KnowledgeItemCard component
 * Tests knowledge item display, actions, and state management
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { KnowledgeItemCard } from '../../../src/components/knowledge-base/KnowledgeItemCard'

// Mock dependencies
vi.mock('../../../src/services/knowledgeService', () => ({
  knowledgeService: {
    deleteKnowledgeItem: vi.fn(),
    updateKnowledgeItem: vi.fn(),
  }
}))

vi.mock('../../../src/contexts/ToastContext', () => ({
  useToast: () => ({
    addToast: vi.fn(),
  })
}))

describe('KnowledgeItemCard Component', () => {
  const mockKnowledgeItem = {
    id: 'test-id-1',
    title: 'Test Knowledge Item',
    url: 'https://example.com/test',
    description: 'This is a test knowledge item description',
    knowledge_type: 'documentation' as const,
    tags: ['react', 'testing'],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    last_crawled: '2024-01-01T00:00:00Z',
    document_count: 5,
    update_frequency: 7,
    metadata: {
      source_type: 'website',
      crawl_depth: 2,
    }
  }

  const defaultProps = {
    item: mockKnowledgeItem,
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onRefresh: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('renders knowledge item with basic information', () => {
    render(<KnowledgeItemCard {...defaultProps} />)
    
    expect(screen.getByText('Test Knowledge Item')).toBeInTheDocument()
    expect(screen.getByText('https://example.com/test')).toBeInTheDocument()
    expect(screen.getByText('This is a test knowledge item description')).toBeInTheDocument()
    expect(screen.getByText('5 documents')).toBeInTheDocument()
  })

  test('displays tags correctly', () => {
    render(<KnowledgeItemCard {...defaultProps} />)
    
    expect(screen.getByText('react')).toBeInTheDocument()
    expect(screen.getByText('testing')).toBeInTheDocument()
  })

  test('shows knowledge type badge', () => {
    render(<KnowledgeItemCard {...defaultProps} />)
    
    expect(screen.getByText('documentation')).toBeInTheDocument()
  })

  test('displays formatted timestamps', () => {
    render(<KnowledgeItemCard {...defaultProps} />)
    
    // Should display relative time (e.g., "2 days ago")
    expect(screen.getByText(/ago/)).toBeInTheDocument()
  })

  test('handles edit action', () => {
    const onEdit = vi.fn()
    render(<KnowledgeItemCard {...defaultProps} onEdit={onEdit} />)
    
    const editButton = screen.getByLabelText(/edit/i)
    fireEvent.click(editButton)
    
    expect(onEdit).toHaveBeenCalledWith(mockKnowledgeItem)
  })

  test('handles delete action with confirmation', async () => {
    const onDelete = vi.fn()
    global.confirm = vi.fn(() => true)
    
    render(<KnowledgeItemCard {...defaultProps} onDelete={onDelete} />)
    
    const deleteButton = screen.getByLabelText(/delete/i)
    fireEvent.click(deleteButton)
    
    expect(global.confirm).toHaveBeenCalledWith(
      expect.stringContaining('Are you sure you want to delete')
    )
    
    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('test-id-1')
    })
  })

  test('cancels delete when confirmation is denied', () => {
    const onDelete = vi.fn()
    global.confirm = vi.fn(() => false)
    
    render(<KnowledgeItemCard {...defaultProps} onDelete={onDelete} />)
    
    const deleteButton = screen.getByLabelText(/delete/i)
    fireEvent.click(deleteButton)
    
    expect(onDelete).not.toHaveBeenCalled()
  })

  test('handles refresh action', () => {
    const onRefresh = vi.fn()
    render(<KnowledgeItemCard {...defaultProps} onRefresh={onRefresh} />)
    
    const refreshButton = screen.getByLabelText(/refresh/i)
    fireEvent.click(refreshButton)
    
    expect(onRefresh).toHaveBeenCalledWith('test-id-1')
  })

  test('shows loading state during refresh', () => {
    const props = {
      ...defaultProps,
      item: { ...mockKnowledgeItem, isRefreshing: true }
    }
    
    render(<KnowledgeItemCard {...props} />)
    
    expect(screen.getByText(/refreshing/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/refresh/i)).toBeDisabled()
  })

  test('displays error state', () => {
    const props = {
      ...defaultProps,
      item: { 
        ...mockKnowledgeItem, 
        error: 'Failed to crawl website',
        status: 'error' as const
      }
    }
    
    render(<KnowledgeItemCard {...props} />)
    
    expect(screen.getByText(/error/i)).toBeInTheDocument()
    expect(screen.getByText('Failed to crawl website')).toBeInTheDocument()
  })

  test('displays success state after recent update', () => {
    const recentTime = new Date(Date.now() - 5 * 60 * 1000).toISOString() // 5 minutes ago
    const props = {
      ...defaultProps,
      item: { 
        ...mockKnowledgeItem, 
        last_crawled: recentTime,
        status: 'completed' as const
      }
    }
    
    render(<KnowledgeItemCard {...props} />)
    
    expect(screen.getByText(/updated/i)).toBeInTheDocument()
  })

  test('handles click on URL to open in new tab', () => {
    const mockOpen = vi.fn()
    global.open = mockOpen
    
    render(<KnowledgeItemCard {...defaultProps} />)
    
    const urlLink = screen.getByText('https://example.com/test')
    fireEvent.click(urlLink)
    
    expect(mockOpen).toHaveBeenCalledWith('https://example.com/test', '_blank')
  })

  test('shows document count with proper pluralization', () => {
    const { rerender } = render(<KnowledgeItemCard {...defaultProps} />)
    
    expect(screen.getByText('5 documents')).toBeInTheDocument()
    
    const singleDocProps = {
      ...defaultProps,
      item: { ...mockKnowledgeItem, document_count: 1 }
    }
    
    rerender(<KnowledgeItemCard {...singleDocProps} />)
    expect(screen.getByText('1 document')).toBeInTheDocument()
  })

  test('displays update frequency information', () => {
    render(<KnowledgeItemCard {...defaultProps} />)
    
    expect(screen.getByText(/weekly/i)).toBeInTheDocument()
  })

  test('handles missing description gracefully', () => {
    const props = {
      ...defaultProps,
      item: { ...mockKnowledgeItem, description: null }
    }
    
    render(<KnowledgeItemCard {...props} />)
    
    expect(screen.queryByText('This is a test knowledge item description')).not.toBeInTheDocument()
    expect(screen.getByText('Test Knowledge Item')).toBeInTheDocument() // Title should still be there
  })

  test('handles empty tags array', () => {
    const props = {
      ...defaultProps,
      item: { ...mockKnowledgeItem, tags: [] }
    }
    
    render(<KnowledgeItemCard {...props} />)
    
    expect(screen.queryByText('react')).not.toBeInTheDocument()
    expect(screen.queryByText('testing')).not.toBeInTheDocument()
  })

  test('accessibility attributes', () => {
    render(<KnowledgeItemCard {...defaultProps} />)
    
    const card = screen.getByRole('article')
    expect(card).toHaveAttribute('aria-label', expect.stringContaining('Test Knowledge Item'))
    
    const editButton = screen.getByLabelText(/edit/i)
    expect(editButton).toHaveAttribute('aria-label')
    
    const deleteButton = screen.getByLabelText(/delete/i)
    expect(deleteButton).toHaveAttribute('aria-label')
    
    const refreshButton = screen.getByLabelText(/refresh/i)
    expect(refreshButton).toHaveAttribute('aria-label')
  })

  test('keyboard navigation for actions', () => {
    const onEdit = vi.fn()
    render(<KnowledgeItemCard {...defaultProps} onEdit={onEdit} />)
    
    const editButton = screen.getByLabelText(/edit/i)
    editButton.focus()
    
    fireEvent.keyDown(editButton, { key: 'Enter' })
    expect(onEdit).toHaveBeenCalledWith(mockKnowledgeItem)
    
    fireEvent.keyDown(editButton, { key: ' ' })
    expect(onEdit).toHaveBeenCalledTimes(2)
  })

  test('handles long titles and descriptions gracefully', () => {
    const longTitle = 'This is a very long title that should be handled gracefully by the component and not break the layout'
    const longDescription = 'This is a very long description that should be truncated or wrapped properly to maintain good visual hierarchy and readability within the card component'
    
    const props = {
      ...defaultProps,
      item: {
        ...mockKnowledgeItem,
        title: longTitle,
        description: longDescription
      }
    }
    
    render(<KnowledgeItemCard {...props} />)
    
    expect(screen.getByText(longTitle)).toBeInTheDocument()
    expect(screen.getByText(longDescription)).toBeInTheDocument()
  })

  test('shows proper status indicators', () => {
    const statusTests = [
      { status: 'processing', expectedText: /processing/i },
      { status: 'completed', expectedText: /completed/i },
      { status: 'error', expectedText: /error/i },
      { status: 'pending', expectedText: /pending/i },
    ]
    
    statusTests.forEach(({ status, expectedText }) => {
      const props = {
        ...defaultProps,
        item: { ...mockKnowledgeItem, status: status as any }
      }
      
      const { unmount } = render(<KnowledgeItemCard {...props} />)
      expect(screen.getByText(expectedText)).toBeInTheDocument()
      unmount()
    })
  })
})