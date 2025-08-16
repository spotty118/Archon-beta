import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { KnowledgeTable } from '@/components/knowledge-base/KnowledgeTable'
import { KnowledgeItem } from '@/types'

// Mock Lucide React icons
vi.mock('lucide-react', () => ({
  Search: () => <div data-testid="search-icon">Search</div>,
  Filter: () => <div data-testid="filter-icon">Filter</div>,
  Download: () => <div data-testid="download-icon">Download</div>,
  ExternalLink: () => <div data-testid="external-link-icon">ExternalLink</div>,
  Edit: () => <div data-testid="edit-icon">Edit</div>,
  Trash2: () => <div data-testid="trash-icon">Trash2</div>,
  Eye: () => <div data-testid="eye-icon">Eye</div>,
  Calendar: () => <div data-testid="calendar-icon">Calendar</div>,
  File: () => <div data-testid="file-icon">File</div>,
  Globe: () => <div data-testid="globe-icon">Globe</div>,
}))

const mockKnowledgeItems: KnowledgeItem[] = [
  {
    id: '1',
    title: 'React Documentation',
    url: 'https://react.dev',
    source_type: 'url',
    status: 'processed',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    document_count: 15,
    metadata: { description: 'Official React documentation' }
  },
  {
    id: '2',
    title: 'TypeScript Handbook',
    url: 'https://typescriptlang.org/docs',
    source_type: 'url',
    status: 'processing',
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
    document_count: 8,
    metadata: { description: 'TypeScript language handbook' }
  },
  {
    id: '3',
    title: 'API Documentation',
    url: 'api-docs.pdf',
    source_type: 'upload',
    status: 'failed',
    created_at: '2024-01-03T00:00:00Z',
    updated_at: '2024-01-03T00:00:00Z',
    document_count: 0,
    metadata: { description: 'Internal API documentation', error: 'Parse error' }
  }
]

const defaultProps = {
  items: mockKnowledgeItems,
  onEdit: vi.fn(),
  onDelete: vi.fn(),
  onRefresh: vi.fn(),
  onViewDocuments: vi.fn(),
  isLoading: false
}

describe('KnowledgeTable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('renders knowledge items in table format', () => {
    render(<KnowledgeTable {...defaultProps} />)
    
    // Check table headers
    expect(screen.getByText('Title')).toBeInTheDocument()
    expect(screen.getByText('Source')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
    expect(screen.getByText('Documents')).toBeInTheDocument()
    expect(screen.getByText('Created')).toBeInTheDocument()
    expect(screen.getByText('Actions')).toBeInTheDocument()
    
    // Check knowledge items are rendered
    expect(screen.getByText('React Documentation')).toBeInTheDocument()
    expect(screen.getByText('TypeScript Handbook')).toBeInTheDocument()
    expect(screen.getByText('API Documentation')).toBeInTheDocument()
  })

  test('displays correct status badges', () => {
    render(<KnowledgeTable {...defaultProps} />)
    
    // Check status indicators
    expect(screen.getByText('processed')).toBeInTheDocument()
    expect(screen.getByText('processing')).toBeInTheDocument()
    expect(screen.getByText('failed')).toBeInTheDocument()
  })

  test('shows correct source type icons', () => {
    render(<KnowledgeTable {...defaultProps} />)
    
    // URL sources should show globe icon
    const globeIcons = screen.getAllByTestId('globe-icon')
    expect(globeIcons).toHaveLength(2) // React and TypeScript docs
    
    // Upload sources should show file icon
    const fileIcons = screen.getAllByTestId('file-icon')
    expect(fileIcons).toHaveLength(1) // API docs
  })

  test('displays document counts correctly', () => {
    render(<KnowledgeTable {...defaultProps} />)
    
    expect(screen.getByText('15')).toBeInTheDocument() // React docs
    expect(screen.getByText('8')).toBeInTheDocument() // TypeScript docs
    expect(screen.getByText('0')).toBeInTheDocument() // Failed API docs
  })

  test('calls onEdit when edit button is clicked', async () => {
    render(<KnowledgeTable {...defaultProps} />)
    
    const editButtons = screen.getAllByTestId('edit-icon')
    fireEvent.click(editButtons[0])
    
    expect(defaultProps.onEdit).toHaveBeenCalledWith(mockKnowledgeItems[0])
  })

  test('calls onDelete when delete button is clicked', async () => {
    render(<KnowledgeTable {...defaultProps} />)
    
    const deleteButtons = screen.getAllByTestId('trash-icon')
    fireEvent.click(deleteButtons[0])
    
    expect(defaultProps.onDelete).toHaveBeenCalledWith(mockKnowledgeItems[0])
  })

  test('calls onViewDocuments when view button is clicked', async () => {
    render(<KnowledgeTable {...defaultProps} />)
    
    const viewButtons = screen.getAllByTestId('eye-icon')
    fireEvent.click(viewButtons[0])
    
    expect(defaultProps.onViewDocuments).toHaveBeenCalledWith(mockKnowledgeItems[0])
  })

  test('opens external URLs when external link is clicked', () => {
    // Mock window.open
    const mockOpen = vi.fn()
    Object.defineProperty(window, 'open', { value: mockOpen })
    
    render(<KnowledgeTable {...defaultProps} />)
    
    const externalLinkButtons = screen.getAllByTestId('external-link-icon')
    fireEvent.click(externalLinkButtons[0])
    
    expect(mockOpen).toHaveBeenCalledWith('https://react.dev', '_blank')
  })

  test('filters items by search query', async () => {
    render(<KnowledgeTable {...defaultProps} />)
    
    const searchInput = screen.getByPlaceholderText(/search knowledge/i)
    fireEvent.change(searchInput, { target: { value: 'React' } })
    
    await waitFor(() => {
      expect(screen.getByText('React Documentation')).toBeInTheDocument()
      expect(screen.queryByText('TypeScript Handbook')).not.toBeInTheDocument()
      expect(screen.queryByText('API Documentation')).not.toBeInTheDocument()
    })
  })

  test('filters items by status', async () => {
    render(<KnowledgeTable {...defaultProps} />)
    
    const statusFilter = screen.getByDisplayValue('All')
    fireEvent.change(statusFilter, { target: { value: 'processed' } })
    
    await waitFor(() => {
      expect(screen.getByText('React Documentation')).toBeInTheDocument()
      expect(screen.queryByText('TypeScript Handbook')).not.toBeInTheDocument()
      expect(screen.queryByText('API Documentation')).not.toBeInTheDocument()
    })
  })

  test('filters items by source type', async () => {
    render(<KnowledgeTable {...defaultProps} />)
    
    const sourceFilter = screen.getByDisplayValue('All Sources')
    fireEvent.change(sourceFilter, { target: { value: 'upload' } })
    
    await waitFor(() => {
      expect(screen.queryByText('React Documentation')).not.toBeInTheDocument()
      expect(screen.queryByText('TypeScript Handbook')).not.toBeInTheDocument()
      expect(screen.getByText('API Documentation')).toBeInTheDocument()
    })
  })

  test('sorts items by different criteria', async () => {
    render(<KnowledgeTable {...defaultProps} />)
    
    // Test sort by title
    const titleHeader = screen.getByText('Title')
    fireEvent.click(titleHeader)
    
    await waitFor(() => {
      const rows = screen.getAllByRole('row')
      // Should be sorted alphabetically
      expect(rows[1]).toHaveTextContent('API Documentation')
      expect(rows[2]).toHaveTextContent('React Documentation')
      expect(rows[3]).toHaveTextContent('TypeScript Handbook')
    })
  })

  test('shows loading state', () => {
    render(<KnowledgeTable {...defaultProps} isLoading={true} />)
    
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  test('shows empty state when no items', () => {
    render(<KnowledgeTable {...defaultProps} items={[]} />)
    
    expect(screen.getByText(/no knowledge items/i)).toBeInTheDocument()
  })

  test('shows no results when search returns empty', async () => {
    render(<KnowledgeTable {...defaultProps} />)
    
    const searchInput = screen.getByPlaceholderText(/search knowledge/i)
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } })
    
    await waitFor(() => {
      expect(screen.getByText(/no items match/i)).toBeInTheDocument()
    })
  })

  test('shows error state for failed items', () => {
    render(<KnowledgeTable {...defaultProps} />)
    
    const failedItem = screen.getByText('API Documentation').closest('tr')
    expect(failedItem).toHaveTextContent('failed')
    expect(failedItem).toHaveTextContent('Parse error')
  })

  test('handles bulk operations', async () => {
    render(<KnowledgeTable {...defaultProps} />)
    
    // Select multiple items
    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[1]) // First item checkbox (index 0 is select all)
    fireEvent.click(checkboxes[2]) // Second item checkbox
    
    // Bulk delete
    const bulkDeleteButton = screen.getByText(/delete selected/i)
    fireEvent.click(bulkDeleteButton)
    
    expect(defaultProps.onDelete).toHaveBeenCalledTimes(2)
  })

  test('supports keyboard navigation', () => {
    render(<KnowledgeTable {...defaultProps} />)
    
    const firstRow = screen.getAllByRole('row')[1] // Skip header row
    firstRow.focus()
    
    expect(document.activeElement).toBe(firstRow)
    
    // Test Enter key to view details
    fireEvent.keyDown(firstRow, { key: 'Enter' })
    expect(defaultProps.onViewDocuments).toHaveBeenCalled()
  })

  test('maintains accessibility standards', () => {
    render(<KnowledgeTable {...defaultProps} />)
    
    // Check ARIA labels
    expect(screen.getByRole('table')).toHaveAttribute('aria-label', expect.stringContaining('knowledge'))
    
    // Check column headers
    const columnHeaders = screen.getAllByRole('columnheader')
    expect(columnHeaders.length).toBeGreaterThan(0)
    
    // Check row accessibility
    const rows = screen.getAllByRole('row')
    expect(rows.length).toBeGreaterThan(1) // Header + data rows
  })
})