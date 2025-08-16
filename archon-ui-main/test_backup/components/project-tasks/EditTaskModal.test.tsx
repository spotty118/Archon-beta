import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { EditTaskModal } from '@/components/project-tasks/EditTaskModal'
import { Task } from '@/types'

// Mock Lucide React icons
vi.mock('lucide-react', () => ({
  X: () => <div data-testid="x-icon">X</div>,
  Save: () => <div data-testid="save-icon">Save</div>,
  Calendar: () => <div data-testid="calendar-icon">Calendar</div>,
  User: () => <div data-testid="user-icon">User</div>,
  Flag: () => <div data-testid="flag-icon">Flag</div>,
  Tag: () => <div data-testid="tag-icon">Tag</div>,
  AlertCircle: () => <div data-testid="alert-icon">AlertCircle</div>,
  Clock: () => <div data-testid="clock-icon">Clock</div>,
}))

const mockTask: Task = {
  id: '1',
  title: 'Implement OAuth2 authentication',
  description: 'Add secure OAuth2 authentication with Google and GitHub providers',
  status: 'todo',
  priority: 'high',
  assignee: 'AI IDE Agent',
  task_order: 5,
  feature: 'authentication',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  project_id: 'project-1',
  due_date: '2024-02-01T00:00:00Z',
  sources: [
    { url: 'https://oauth.net/2/', type: 'documentation', relevance: 'OAuth2 specification' }
  ],
  code_examples: [
    { file: 'auth/oauth.js', function: 'createOAuthProvider', purpose: 'OAuth provider setup' }
  ]
}

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  onSave: vi.fn(),
  task: mockTask,
  isLoading: false,
  assigneeOptions: ['User', 'AI IDE Agent', 'prp-executor', 'prp-validator'],
  featureOptions: ['authentication', 'database', 'frontend', 'backend']
}

describe('EditTaskModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('renders modal with task data', () => {
    render(<EditTaskModal {...defaultProps} />)
    
    expect(screen.getByText('Edit Task')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Implement OAuth2 authentication')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Add secure OAuth2 authentication with Google and GitHub providers')).toBeInTheDocument()
    expect(screen.getByDisplayValue('AI IDE Agent')).toBeInTheDocument()
    expect(screen.getByDisplayValue('high')).toBeInTheDocument()
    expect(screen.getByDisplayValue('authentication')).toBeInTheDocument()
  })

  test('does not render when closed', () => {
    render(<EditTaskModal {...defaultProps} isOpen={false} />)
    
    expect(screen.queryByText('Edit Task')).not.toBeInTheDocument()
  })

  test('closes modal when X button is clicked', () => {
    render(<EditTaskModal {...defaultProps} />)
    
    const closeButton = screen.getByTestId('x-icon')
    fireEvent.click(closeButton)
    
    expect(defaultProps.onClose).toHaveBeenCalled()
  })

  test('closes modal when Escape key is pressed', () => {
    render(<EditTaskModal {...defaultProps} />)
    
    fireEvent.keyDown(document, { key: 'Escape' })
    
    expect(defaultProps.onClose).toHaveBeenCalled()
  })

  test('updates task title', () => {
    render(<EditTaskModal {...defaultProps} />)
    
    const titleInput = screen.getByDisplayValue('Implement OAuth2 authentication')
    fireEvent.change(titleInput, { target: { value: 'Updated OAuth2 implementation' } })
    
    expect(titleInput).toHaveValue('Updated OAuth2 implementation')
  })

  test('updates task description', () => {
    render(<EditTaskModal {...defaultProps} />)
    
    const descriptionInput = screen.getByDisplayValue('Add secure OAuth2 authentication with Google and GitHub providers')
    fireEvent.change(descriptionInput, { target: { value: 'Updated description' } })
    
    expect(descriptionInput).toHaveValue('Updated description')
  })

  test('updates task status', () => {
    render(<EditTaskModal {...defaultProps} />)
    
    const statusSelect = screen.getByDisplayValue('todo')
    fireEvent.change(statusSelect, { target: { value: 'doing' } })
    
    expect(statusSelect).toHaveValue('doing')
  })

  test('updates task priority', () => {
    render(<EditTaskModal {...defaultProps} />)
    
    const prioritySelect = screen.getByDisplayValue('high')
    fireEvent.change(prioritySelect, { target: { value: 'medium' } })
    
    expect(prioritySelect).toHaveValue('medium')
  })

  test('updates task assignee', () => {
    render(<EditTaskModal {...defaultProps} />)
    
    const assigneeSelect = screen.getByDisplayValue('AI IDE Agent')
    fireEvent.change(assigneeSelect, { target: { value: 'User' } })
    
    expect(assigneeSelect).toHaveValue('User')
  })

  test('updates task order', () => {
    render(<EditTaskModal {...defaultProps} />)
    
    const taskOrderInput = screen.getByDisplayValue('5')
    fireEvent.change(taskOrderInput, { target: { value: '10' } })
    
    expect(taskOrderInput).toHaveValue('10')
  })

  test('updates feature selection', () => {
    render(<EditTaskModal {...defaultProps} />)
    
    const featureSelect = screen.getByDisplayValue('authentication')
    fireEvent.change(featureSelect, { target: { value: 'backend' } })
    
    expect(featureSelect).toHaveValue('backend')
  })

  test('validates required fields', async () => {
    render(<EditTaskModal {...defaultProps} />)
    
    const titleInput = screen.getByDisplayValue('Implement OAuth2 authentication')
    fireEvent.change(titleInput, { target: { value: '' } })
    
    const saveButton = screen.getByText('Save Changes')
    fireEvent.click(saveButton)
    
    await waitFor(() => {
      expect(screen.getByText(/title is required/i)).toBeInTheDocument()
    })
    
    expect(defaultProps.onSave).not.toHaveBeenCalled()
  })

  test('validates task order is positive number', async () => {
    render(<EditTaskModal {...defaultProps} />)
    
    const taskOrderInput = screen.getByDisplayValue('5')
    fireEvent.change(taskOrderInput, { target: { value: '-1' } })
    
    const saveButton = screen.getByText('Save Changes')
    fireEvent.click(saveButton)
    
    await waitFor(() => {
      expect(screen.getByText(/task order must be positive/i)).toBeInTheDocument()
    })
    
    expect(defaultProps.onSave).not.toHaveBeenCalled()
  })

  test('validates due date is in future', async () => {
    render(<EditTaskModal {...defaultProps} />)
    
    const dueDateInput = screen.getByLabelText(/due date/i)
    fireEvent.change(dueDateInput, { target: { value: '2020-01-01' } })
    
    const saveButton = screen.getByText('Save Changes')
    fireEvent.click(saveButton)
    
    await waitFor(() => {
      expect(screen.getByText(/due date cannot be in the past/i)).toBeInTheDocument()
    })
    
    expect(defaultProps.onSave).not.toHaveBeenCalled()
  })

  test('saves task with valid data', async () => {
    render(<EditTaskModal {...defaultProps} />)
    
    const titleInput = screen.getByDisplayValue('Implement OAuth2 authentication')
    fireEvent.change(titleInput, { target: { value: 'Updated OAuth2 implementation' } })
    
    const prioritySelect = screen.getByDisplayValue('high')
    fireEvent.change(prioritySelect, { target: { value: 'medium' } })
    
    const saveButton = screen.getByText('Save Changes')
    fireEvent.click(saveButton)
    
    await waitFor(() => {
      expect(defaultProps.onSave).toHaveBeenCalledWith({
        ...mockTask,
        title: 'Updated OAuth2 implementation',
        priority: 'medium'
      })
    })
  })

  test('shows loading state when saving', () => {
    render(<EditTaskModal {...defaultProps} isLoading={true} />)
    
    const saveButton = screen.getByText('Saving...')
    expect(saveButton).toBeDisabled()
  })

  test('handles due date selection', () => {
    render(<EditTaskModal {...defaultProps} />)
    
    const dueDateInput = screen.getByLabelText(/due date/i)
    fireEvent.change(dueDateInput, { target: { value: '2024-03-01' } })
    
    expect(dueDateInput).toHaveValue('2024-03-01')
  })

  test('clears due date', () => {
    render(<EditTaskModal {...defaultProps} />)
    
    const clearDueDateButton = screen.getByText(/clear due date/i)
    fireEvent.click(clearDueDateButton)
    
    const dueDateInput = screen.getByLabelText(/due date/i)
    expect(dueDateInput).toHaveValue('')
  })

  test('manages task sources', async () => {
    render(<EditTaskModal {...defaultProps} />)
    
    // Add new source
    const addSourceButton = screen.getByText(/add source/i)
    fireEvent.click(addSourceButton)
    
    const sourceUrlInput = screen.getByPlaceholderText(/source url/i)
    fireEvent.change(sourceUrlInput, { target: { value: 'https://example.com' } })
    
    const sourceTypeInput = screen.getByPlaceholderText(/source type/i)
    fireEvent.change(sourceTypeInput, { target: { value: 'reference' } })
    
    const sourceRelevanceInput = screen.getByPlaceholderText(/relevance/i)
    fireEvent.change(sourceRelevanceInput, { target: { value: 'Additional reference' } })
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('https://example.com')).toBeInTheDocument()
    })
  })

  test('removes task sources', async () => {
    render(<EditTaskModal {...defaultProps} />)
    
    const removeSourceButton = screen.getByLabelText(/remove source/i)
    fireEvent.click(removeSourceButton)
    
    await waitFor(() => {
      expect(screen.queryByDisplayValue('https://oauth.net/2/')).not.toBeInTheDocument()
    })
  })

  test('manages code examples', async () => {
    render(<EditTaskModal {...defaultProps} />)
    
    // Add new code example
    const addExampleButton = screen.getByText(/add code example/i)
    fireEvent.click(addExampleButton)
    
    const fileInput = screen.getByPlaceholderText(/file path/i)
    fireEvent.change(fileInput, { target: { value: 'utils/auth.js' } })
    
    const functionInput = screen.getByPlaceholderText(/function name/i)
    fireEvent.change(functionInput, { target: { value: 'validateToken' } })
    
    const purposeInput = screen.getByPlaceholderText(/purpose/i)
    fireEvent.change(purposeInput, { target: { value: 'Token validation utility' } })
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('utils/auth.js')).toBeInTheDocument()
    })
  })

  test('removes code examples', async () => {
    render(<EditTaskModal {...defaultProps} />)
    
    const removeExampleButton = screen.getByLabelText(/remove code example/i)
    fireEvent.click(removeExampleButton)
    
    await waitFor(() => {
      expect(screen.queryByDisplayValue('auth/oauth.js')).not.toBeInTheDocument()
    })
  })

  test('shows task metadata', () => {
    render(<EditTaskModal {...defaultProps} />)
    
    expect(screen.getByText(/created/i)).toBeInTheDocument()
    expect(screen.getByText(/updated/i)).toBeInTheDocument()
    expect(screen.getByTestId('clock-icon')).toBeInTheDocument()
  })

  test('supports keyboard shortcuts', async () => {
    render(<EditTaskModal {...defaultProps} />)
    
    const titleInput = screen.getByDisplayValue('Implement OAuth2 authentication')
    titleInput.focus()
    
    // Ctrl+S to save
    fireEvent.keyDown(titleInput, { key: 's', ctrlKey: true })
    
    await waitFor(() => {
      expect(defaultProps.onSave).toHaveBeenCalled()
    })
  })

  test('maintains focus trap within modal', () => {
    render(<EditTaskModal {...defaultProps} />)
    
    const modal = screen.getByRole('dialog')
    const focusableElements = modal.querySelectorAll(
      'button, input, textarea, select, [tabindex]:not([tabindex="-1"])'
    )
    
    expect(focusableElements.length).toBeGreaterThan(0)
    
    // First focusable element should receive focus
    expect(document.activeElement).toBe(focusableElements[0])
  })

  test('resets form when task changes', () => {
    const { rerender } = render(<EditTaskModal {...defaultProps} />)
    
    // Change title
    const titleInput = screen.getByDisplayValue('Implement OAuth2 authentication')
    fireEvent.change(titleInput, { target: { value: 'Modified Title' } })
    
    // Change task prop
    const newTask = { ...mockTask, title: 'Different Task' }
    rerender(<EditTaskModal {...defaultProps} task={newTask} />)
    
    // Form should reset to new task data
    expect(screen.getByDisplayValue('Different Task')).toBeInTheDocument()
  })

  test('handles empty assignee options gracefully', () => {
    render(<EditTaskModal {...defaultProps} assigneeOptions={[]} />)
    
    const assigneeSelect = screen.getByDisplayValue('AI IDE Agent')
    expect(assigneeSelect).toBeInTheDocument()
    
    // Should still show current assignee even if not in options
    expect(screen.getByDisplayValue('AI IDE Agent')).toBeInTheDocument()
  })

  test('handles empty feature options gracefully', () => {
    render(<EditTaskModal {...defaultProps} featureOptions={[]} />)
    
    const featureSelect = screen.getByDisplayValue('authentication')
    expect(featureSelect).toBeInTheDocument()
    
    // Should still show current feature even if not in options
    expect(screen.getByDisplayValue('authentication')).toBeInTheDocument()
  })

  test('shows priority color indicators', () => {
    render(<EditTaskModal {...defaultProps} />)
    
    const prioritySection = screen.getByLabelText(/priority/i).parentElement
    expect(prioritySection).toHaveClass(expect.stringMatching(/priority.*high/i))
  })

  test('supports rich text editing in description', async () => {
    render(<EditTaskModal {...defaultProps} />)
    
    const descriptionTextarea = screen.getByDisplayValue('Add secure OAuth2 authentication with Google and GitHub providers')
    
    // Should support markdown preview toggle
    const previewButton = screen.getByText(/preview/i)
    fireEvent.click(previewButton)
    
    await waitFor(() => {
      expect(screen.getByText(/markdown preview/i)).toBeInTheDocument()
    })
  })

  test('handles task template application', async () => {
    render(<EditTaskModal {...defaultProps} />)
    
    const templateButton = screen.getByText(/apply template/i)
    fireEvent.click(templateButton)
    
    const bugTemplate = screen.getByText(/bug report template/i)
    fireEvent.click(bugTemplate)
    
    await waitFor(() => {
      expect(screen.getByDisplayValue(/bug:/i)).toBeInTheDocument()
    })
  })
})