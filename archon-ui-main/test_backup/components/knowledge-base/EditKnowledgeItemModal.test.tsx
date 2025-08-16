import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { EditKnowledgeItemModal } from '@/components/knowledge-base/EditKnowledgeItemModal'
import { KnowledgeItem } from '@/types'

// Mock Lucide React icons
vi.mock('lucide-react', () => ({
  X: () => <div data-testid="x-icon">X</div>,
  Save: () => <div data-testid="save-icon">Save</div>,
  Globe: () => <div data-testid="globe-icon">Globe</div>,
  File: () => <div data-testid="file-icon">File</div>,
  AlertCircle: () => <div data-testid="alert-icon">AlertCircle</div>,
}))

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
    tags: ['react', 'documentation', 'frontend']
  }
}

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  onSave: vi.fn(),
  item: mockKnowledgeItem,
  isLoading: false
}

describe('EditKnowledgeItemModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('renders modal with knowledge item data', () => {
    render(<EditKnowledgeItemModal {...defaultProps} />)
    
    expect(screen.getByText('Edit Knowledge Item')).toBeInTheDocument()
    expect(screen.getByDisplayValue('React Documentation')).toBeInTheDocument()
    expect(screen.getByDisplayValue('https://react.dev')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Official React documentation')).toBeInTheDocument()
  })

  test('does not render when closed', () => {
    render(<EditKnowledgeItemModal {...defaultProps} isOpen={false} />)
    
    expect(screen.queryByText('Edit Knowledge Item')).not.toBeInTheDocument()
  })

  test('closes modal when X button is clicked', () => {
    render(<EditKnowledgeItemModal {...defaultProps} />)
    
    const closeButton = screen.getByTestId('x-icon')
    fireEvent.click(closeButton)
    
    expect(defaultProps.onClose).toHaveBeenCalled()
  })

  test('closes modal when backdrop is clicked', () => {
    render(<EditKnowledgeItemModal {...defaultProps} />)
    
    const backdrop = screen.getByRole('dialog').parentElement
    fireEvent.click(backdrop!)
    
    expect(defaultProps.onClose).toHaveBeenCalled()
  })

  test('closes modal when Escape key is pressed', () => {
    render(<EditKnowledgeItemModal {...defaultProps} />)
    
    fireEvent.keyDown(document, { key: 'Escape' })
    
    expect(defaultProps.onClose).toHaveBeenCalled()
  })

  test('updates title field', () => {
    render(<EditKnowledgeItemModal {...defaultProps} />)
    
    const titleInput = screen.getByDisplayValue('React Documentation')
    fireEvent.change(titleInput, { target: { value: 'Updated React Docs' } })
    
    expect(titleInput).toHaveValue('Updated React Docs')
  })

  test('updates URL field for URL sources', () => {
    render(<EditKnowledgeItemModal {...defaultProps} />)
    
    const urlInput = screen.getByDisplayValue('https://react.dev')
    fireEvent.change(urlInput, { target: { value: 'https://reactjs.org' } })
    
    expect(urlInput).toHaveValue('https://reactjs.org')
  })

  test('updates description field', () => {
    render(<EditKnowledgeItemModal {...defaultProps} />)
    
    const descriptionInput = screen.getByDisplayValue('Official React documentation')
    fireEvent.change(descriptionInput, { target: { value: 'Updated description' } })
    
    expect(descriptionInput).toHaveValue('Updated description')
  })

  test('validates required fields', async () => {
    render(<EditKnowledgeItemModal {...defaultProps} />)
    
    const titleInput = screen.getByDisplayValue('React Documentation')
    fireEvent.change(titleInput, { target: { value: '' } })
    
    const saveButton = screen.getByText('Save Changes')
    fireEvent.click(saveButton)
    
    await waitFor(() => {
      expect(screen.getByText(/title is required/i)).toBeInTheDocument()
    })
    
    expect(defaultProps.onSave).not.toHaveBeenCalled()
  })

  test('validates URL format for URL sources', async () => {
    render(<EditKnowledgeItemModal {...defaultProps} />)
    
    const urlInput = screen.getByDisplayValue('https://react.dev')
    fireEvent.change(urlInput, { target: { value: 'invalid-url' } })
    
    const saveButton = screen.getByText('Save Changes')
    fireEvent.click(saveButton)
    
    await waitFor(() => {
      expect(screen.getByText(/valid url/i)).toBeInTheDocument()
    })
    
    expect(defaultProps.onSave).not.toHaveBeenCalled()
  })

  test('saves changes with valid data', async () => {
    render(<EditKnowledgeItemModal {...defaultProps} />)
    
    const titleInput = screen.getByDisplayValue('React Documentation')
    fireEvent.change(titleInput, { target: { value: 'Updated React Docs' } })
    
    const descriptionInput = screen.getByDisplayValue('Official React documentation')
    fireEvent.change(descriptionInput, { target: { value: 'Updated description' } })
    
    const saveButton = screen.getByText('Save Changes')
    fireEvent.click(saveButton)
    
    await waitFor(() => {
      expect(defaultProps.onSave).toHaveBeenCalledWith({
        ...mockKnowledgeItem,
        title: 'Updated React Docs',
        metadata: {
          ...mockKnowledgeItem.metadata,
          description: 'Updated description'
        }
      })
    })
  })

  test('shows loading state when saving', () => {
    render(<EditKnowledgeItemModal {...defaultProps} isLoading={true} />)
    
    const saveButton = screen.getByText('Saving...')
    expect(saveButton).toBeDisabled()
  })

  test('handles upload source type differently', () => {
    const uploadItem = {
      ...mockKnowledgeItem,
      source_type: 'upload' as const,
      url: 'document.pdf'
    }
    
    render(<EditKnowledgeItemModal {...defaultProps} item={uploadItem} />)
    
    // Should show file icon instead of globe
    expect(screen.getByTestId('file-icon')).toBeInTheDocument()
    expect(screen.queryByTestId('globe-icon')).not.toBeInTheDocument()
    
    // Should show filename field instead of URL field
    expect(screen.getByLabelText(/filename/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/url/i)).not.toBeInTheDocument()
  })

  test('displays metadata tags correctly', () => {
    render(<EditKnowledgeItemModal {...defaultProps} />)
    
    expect(screen.getByText('react')).toBeInTheDocument()
    expect(screen.getByText('documentation')).toBeInTheDocument()
    expect(screen.getByText('frontend')).toBeInTheDocument()
  })

  test('allows adding new tags', async () => {
    render(<EditKnowledgeItemModal {...defaultProps} />)
    
    const tagInput = screen.getByPlaceholderText(/add tag/i)
    fireEvent.change(tagInput, { target: { value: 'new-tag' } })
    fireEvent.keyDown(tagInput, { key: 'Enter' })
    
    await waitFor(() => {
      expect(screen.getByText('new-tag')).toBeInTheDocument()
    })
  })

  test('allows removing tags', async () => {
    render(<EditKnowledgeItemModal {...defaultProps} />)
    
    const removeButton = screen.getAllByText('×')[0] // First tag remove button
    fireEvent.click(removeButton)
    
    await waitFor(() => {
      // Assuming 'react' was the first tag
      expect(screen.queryByText('react')).not.toBeInTheDocument()
    })
  })

  test('shows error state for failed items', () => {
    const failedItem = {
      ...mockKnowledgeItem,
      status: 'failed' as const,
      metadata: {
        ...mockKnowledgeItem.metadata,
        error: 'Failed to process document'
      }
    }
    
    render(<EditKnowledgeItemModal {...defaultProps} item={failedItem} />)
    
    expect(screen.getByTestId('alert-icon')).toBeInTheDocument()
    expect(screen.getByText('Failed to process document')).toBeInTheDocument()
  })

  test('displays processing state', () => {
    const processingItem = {
      ...mockKnowledgeItem,
      status: 'processing' as const
    }
    
    render(<EditKnowledgeItemModal {...defaultProps} item={processingItem} />)
    
    expect(screen.getByText(/processing/i)).toBeInTheDocument()
    
    // Save button should be disabled during processing
    const saveButton = screen.getByText('Save Changes')
    expect(saveButton).toBeDisabled()
  })

  test('shows document count information', () => {
    render(<EditKnowledgeItemModal {...defaultProps} />)
    
    expect(screen.getByText(/15 documents/i)).toBeInTheDocument()
  })

  test('formats creation and update dates', () => {
    render(<EditKnowledgeItemModal {...defaultProps} />)
    
    expect(screen.getByText(/created/i)).toBeInTheDocument()
    expect(screen.getByText(/updated/i)).toBeInTheDocument()
  })

  test('maintains focus trap within modal', () => {
    render(<EditKnowledgeItemModal {...defaultProps} />)
    
    const modal = screen.getByRole('dialog')
    const focusableElements = modal.querySelectorAll(
      'button, input, textarea, select, [tabindex]:not([tabindex="-1"])'
    )
    
    expect(focusableElements.length).toBeGreaterThan(0)
    
    // First focusable element should receive focus
    expect(document.activeElement).toBe(focusableElements[0])
  })

  test('supports keyboard navigation', () => {
    render(<EditKnowledgeItemModal {...defaultProps} />)
    
    const titleInput = screen.getByDisplayValue('React Documentation')
    titleInput.focus()
    
    // Tab to next field
    fireEvent.keyDown(titleInput, { key: 'Tab' })
    
    const urlInput = screen.getByDisplayValue('https://react.dev')
    expect(document.activeElement).toBe(urlInput)
  })

  test('handles form submission with Enter key', async () => {
    render(<EditKnowledgeItemModal {...defaultProps} />)
    
    const titleInput = screen.getByDisplayValue('React Documentation')
    fireEvent.keyDown(titleInput, { key: 'Enter', ctrlKey: true })
    
    await waitFor(() => {
      expect(defaultProps.onSave).toHaveBeenCalled()
    })
  })

  test('resets form when item changes', () => {
    const { rerender } = render(<EditKnowledgeItemModal {...defaultProps} />)
    
    // Change title
    const titleInput = screen.getByDisplayValue('React Documentation')
    fireEvent.change(titleInput, { target: { value: 'Modified Title' } })
    
    // Change item prop
    const newItem = { ...mockKnowledgeItem, title: 'Different Item' }
    rerender(<EditKnowledgeItemModal {...defaultProps} item={newItem} />)
    
    // Form should reset to new item data
    expect(screen.getByDisplayValue('Different Item')).toBeInTheDocument()
  })
})