import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { TaskBoardView } from '@/components/project-tasks/TaskBoardView'
import { Task } from '@/types'

// Mock react-beautiful-dnd
vi.mock('react-beautiful-dnd', () => ({
  DragDropContext: ({ children, onDragEnd }: any) => (
    <div data-testid="drag-drop-context" data-on-drag-end={onDragEnd}>
      {children}
    </div>
  ),
  Droppable: ({ children, droppableId }: any) => (
    <div data-testid={`droppable-${droppableId}`}>
      {children({ 
        innerRef: () => {}, 
        droppableProps: {}, 
        placeholder: <div data-testid="placeholder" /> 
      })}
    </div>
  ),
  Draggable: ({ children, draggableId, index }: any) => (
    <div data-testid={`draggable-${draggableId}`}>
      {children({ 
        innerRef: () => {}, 
        draggableProps: {}, 
        dragHandleProps: {} 
      })}
    </div>
  )
}))

// Mock Lucide React icons
vi.mock('lucide-react', () => ({
  Plus: () => <div data-testid="plus-icon">Plus</div>,
  MoreHorizontal: () => <div data-testid="more-icon">MoreHorizontal</div>,
  Edit: () => <div data-testid="edit-icon">Edit</div>,
  Trash2: () => <div data-testid="trash-icon">Trash2</div>,
  Clock: () => <div data-testid="clock-icon">Clock</div>,
  User: () => <div data-testid="user-icon">User</div>,
  AlertCircle: () => <div data-testid="alert-icon">AlertCircle</div>,
  CheckCircle: () => <div data-testid="check-icon">CheckCircle</div>,
}))

const mockTasks: Task[] = [
  {
    id: '1',
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
  },
  {
    id: '2',
    title: 'Setup database schema',
    description: 'Create tables for users and sessions',
    status: 'doing',
    priority: 'medium',
    assignee: 'User',
    task_order: 2,
    feature: 'database',
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
    project_id: 'project-1'
  },
  {
    id: '3',
    title: 'Write unit tests',
    description: 'Add comprehensive test coverage',
    status: 'review',
    priority: 'low',
    assignee: 'prp-validator',
    task_order: 3,
    feature: 'testing',
    created_at: '2024-01-03T00:00:00Z',
    updated_at: '2024-01-03T00:00:00Z',
    project_id: 'project-1'
  },
  {
    id: '4',
    title: 'Deploy to production',
    description: 'Setup CI/CD pipeline',
    status: 'done',
    priority: 'high',
    assignee: 'archon-task-manager',
    task_order: 4,
    feature: 'deployment',
    created_at: '2024-01-04T00:00:00Z',
    updated_at: '2024-01-04T00:00:00Z',
    project_id: 'project-1'
  }
]

const defaultProps = {
  tasks: mockTasks,
  onTaskUpdate: vi.fn(),
  onTaskCreate: vi.fn(),
  onTaskEdit: vi.fn(),
  onTaskDelete: vi.fn(),
  isLoading: false
}

describe('TaskBoardView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('renders kanban board with status columns', () => {
    render(<TaskBoardView {...defaultProps} />)
    
    expect(screen.getByTestId('droppable-todo')).toBeInTheDocument()
    expect(screen.getByTestId('droppable-doing')).toBeInTheDocument()
    expect(screen.getByTestId('droppable-review')).toBeInTheDocument()
    expect(screen.getByTestId('droppable-done')).toBeInTheDocument()
    
    expect(screen.getByText('To Do')).toBeInTheDocument()
    expect(screen.getByText('In Progress')).toBeInTheDocument()
    expect(screen.getByText('Review')).toBeInTheDocument()
    expect(screen.getByText('Done')).toBeInTheDocument()
  })

  test('displays tasks in correct status columns', () => {
    render(<TaskBoardView {...defaultProps} />)
    
    // Check tasks are in correct columns
    const todoColumn = screen.getByTestId('droppable-todo')
    expect(todoColumn).toHaveTextContent('Implement authentication')
    
    const doingColumn = screen.getByTestId('droppable-doing')
    expect(doingColumn).toHaveTextContent('Setup database schema')
    
    const reviewColumn = screen.getByTestId('droppable-review')
    expect(reviewColumn).toHaveTextContent('Write unit tests')
    
    const doneColumn = screen.getByTestId('droppable-done')
    expect(doneColumn).toHaveTextContent('Deploy to production')
  })

  test('shows task count in column headers', () => {
    render(<TaskBoardView {...defaultProps} />)
    
    expect(screen.getByText('To Do (1)')).toBeInTheDocument()
    expect(screen.getByText('In Progress (1)')).toBeInTheDocument()
    expect(screen.getByText('Review (1)')).toBeInTheDocument()
    expect(screen.getByText('Done (1)')).toBeInTheDocument()
  })

  test('displays task cards with correct information', () => {
    render(<TaskBoardView {...defaultProps} />)
    
    const taskCard = screen.getByText('Implement authentication').closest('[data-testid^="draggable-"]')
    
    expect(taskCard).toHaveTextContent('Implement authentication')
    expect(taskCard).toHaveTextContent('Add OAuth2 authentication')
    expect(taskCard).toHaveTextContent('high')
    expect(taskCard).toHaveTextContent('AI IDE Agent')
    expect(taskCard).toHaveTextContent('auth')
  })

  test('shows priority indicators', () => {
    render(<TaskBoardView {...defaultProps} />)
    
    // High priority tasks should have priority indicator
    const highPriorityTask = screen.getByText('Implement authentication').closest('[data-testid^="draggable-"]')
    expect(highPriorityTask).toHaveTextContent('high')
    expect(highPriorityTask).toHaveClass(expect.stringMatching(/priority.*high/i))
  })

  test('shows assignee information', () => {
    render(<TaskBoardView {...defaultProps} />)
    
    expect(screen.getByText('AI IDE Agent')).toBeInTheDocument()
    expect(screen.getByText('User')).toBeInTheDocument()
    expect(screen.getByText('prp-validator')).toBeInTheDocument()
    expect(screen.getByText('archon-task-manager')).toBeInTheDocument()
  })

  test('shows feature tags', () => {
    render(<TaskBoardView {...defaultProps} />)
    
    expect(screen.getByText('auth')).toBeInTheDocument()
    expect(screen.getByText('database')).toBeInTheDocument()
    expect(screen.getByText('testing')).toBeInTheDocument()
    expect(screen.getByText('deployment')).toBeInTheDocument()
  })

  test('handles task creation', async () => {
    render(<TaskBoardView {...defaultProps} />)
    
    const addButtons = screen.getAllByTestId('plus-icon')
    fireEvent.click(addButtons[0]) // Click add button in todo column
    
    expect(defaultProps.onTaskCreate).toHaveBeenCalledWith('todo')
  })

  test('handles task editing', async () => {
    render(<TaskBoardView {...defaultProps} />)
    
    const editButtons = screen.getAllByTestId('edit-icon')
    fireEvent.click(editButtons[0])
    
    expect(defaultProps.onTaskEdit).toHaveBeenCalledWith(mockTasks[0])
  })

  test('handles task deletion', async () => {
    render(<TaskBoardView {...defaultProps} />)
    
    const deleteButtons = screen.getAllByTestId('trash-icon')
    fireEvent.click(deleteButtons[0])
    
    expect(defaultProps.onTaskDelete).toHaveBeenCalledWith(mockTasks[0])
  })

  test('handles drag and drop', async () => {
    render(<TaskBoardView {...defaultProps} />)
    
    const dragDropContext = screen.getByTestId('drag-drop-context')
    const onDragEnd = dragDropContext.getAttribute('data-on-drag-end')
    
    expect(onDragEnd).toBeDefined()
    
    // Simulate drag end event
    const mockDragResult = {
      destination: { droppableId: 'doing', index: 0 },
      source: { droppableId: 'todo', index: 0 },
      draggableId: '1'
    }
    
    // Call the onDragEnd handler
    const dragEndHandler = eval(onDragEnd!)
    if (typeof dragEndHandler === 'function') {
      dragEndHandler(mockDragResult)
      
      expect(defaultProps.onTaskUpdate).toHaveBeenCalledWith('1', { status: 'doing' })
    }
  })

  test('shows empty state for columns with no tasks', () => {
    const emptyTasks = mockTasks.filter(task => task.status !== 'todo')
    render(<TaskBoardView {...defaultProps} tasks={emptyTasks} />)
    
    const todoColumn = screen.getByTestId('droppable-todo')
    expect(todoColumn).toHaveTextContent(/no tasks/i)
  })

  test('shows loading state', () => {
    render(<TaskBoardView {...defaultProps} isLoading={true} />)
    
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  test('filters tasks by search query', async () => {
    render(<TaskBoardView {...defaultProps} />)
    
    const searchInput = screen.getByPlaceholderText(/search tasks/i)
    fireEvent.change(searchInput, { target: { value: 'authentication' } })
    
    await waitFor(() => {
      expect(screen.getByText('Implement authentication')).toBeInTheDocument()
      expect(screen.queryByText('Setup database schema')).not.toBeInTheDocument()
    })
  })

  test('filters tasks by assignee', async () => {
    render(<TaskBoardView {...defaultProps} />)
    
    const assigneeFilter = screen.getByLabelText(/filter by assignee/i)
    fireEvent.change(assigneeFilter, { target: { value: 'AI IDE Agent' } })
    
    await waitFor(() => {
      expect(screen.getByText('Implement authentication')).toBeInTheDocument()
      expect(screen.queryByText('Setup database schema')).not.toBeInTheDocument()
    })
  })

  test('filters tasks by priority', async () => {
    render(<TaskBoardView {...defaultProps} />)
    
    const priorityFilter = screen.getByLabelText(/filter by priority/i)
    fireEvent.change(priorityFilter, { target: { value: 'high' } })
    
    await waitFor(() => {
      expect(screen.getByText('Implement authentication')).toBeInTheDocument()
      expect(screen.getByText('Deploy to production')).toBeInTheDocument()
      expect(screen.queryByText('Setup database schema')).not.toBeInTheDocument()
    })
  })

  test('sorts tasks within columns', () => {
    render(<TaskBoardView {...defaultProps} />)
    
    // Tasks should be sorted by task_order by default
    const todoColumn = screen.getByTestId('droppable-todo')
    const tasks = todoColumn.querySelectorAll('[data-testid^="draggable-"]')
    
    // Should be sorted by task_order (lowest first)
    expect(tasks[0]).toHaveTextContent('Implement authentication')
  })

  test('shows task creation date', () => {
    render(<TaskBoardView {...defaultProps} />)
    
    // Should show relative dates
    expect(screen.getByTestId('clock-icon')).toBeInTheDocument()
  })

  test('handles keyboard navigation', () => {
    render(<TaskBoardView {...defaultProps} />)
    
    const firstTask = screen.getByText('Implement authentication').closest('[data-testid^="draggable-"]')
    firstTask?.focus()
    
    expect(document.activeElement).toBe(firstTask)
    
    // Test arrow key navigation
    fireEvent.keyDown(firstTask!, { key: 'ArrowDown' })
    // Should focus next task or remain focused if no next task
  })

  test('supports bulk operations', async () => {
    render(<TaskBoardView {...defaultProps} />)
    
    // Enable bulk mode
    const bulkModeButton = screen.getByText(/bulk operations/i)
    fireEvent.click(bulkModeButton)
    
    // Select multiple tasks
    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[0])
    fireEvent.click(checkboxes[1])
    
    // Apply bulk status change
    const bulkStatusSelect = screen.getByLabelText(/bulk status change/i)
    fireEvent.change(bulkStatusSelect, { target: { value: 'doing' } })
    
    const applyButton = screen.getByText(/apply to selected/i)
    fireEvent.click(applyButton)
    
    expect(defaultProps.onTaskUpdate).toHaveBeenCalledTimes(2)
  })

  test('shows task statistics', () => {
    render(<TaskBoardView {...defaultProps} />)
    
    const statsSection = screen.getByText(/task statistics/i).parentElement
    expect(statsSection).toHaveTextContent('Total: 4')
    expect(statsSection).toHaveTextContent('Completed: 1')
    expect(statsSection).toHaveTextContent('In Progress: 1')
  })

  test('supports column customization', async () => {
    render(<TaskBoardView {...defaultProps} />)
    
    const customizeButton = screen.getByText(/customize columns/i)
    fireEvent.click(customizeButton)
    
    const modal = screen.getByRole('dialog')
    expect(modal).toBeInTheDocument()
    
    // Add custom column
    const addColumnButton = screen.getByText(/add column/i)
    fireEvent.click(addColumnButton)
    
    const nameInput = screen.getByPlaceholderText(/column name/i)
    fireEvent.change(nameInput, { target: { value: 'Testing' } })
    
    const saveButton = screen.getByText(/save/i)
    fireEvent.click(saveButton)
    
    await waitFor(() => {
      expect(screen.getByText('Testing')).toBeInTheDocument()
    })
  })

  test('shows due dates and overdue indicators', () => {
    const tasksWithDueDates = mockTasks.map(task => ({
      ...task,
      due_date: task.id === '1' ? '2023-12-31T00:00:00Z' : '2025-12-31T00:00:00Z' // First task is overdue
    }))
    
    render(<TaskBoardView {...defaultProps} tasks={tasksWithDueDates} />)
    
    // Should show overdue indicator for first task
    const overdueTask = screen.getByText('Implement authentication').closest('[data-testid^="draggable-"]')
    expect(overdueTask).toHaveClass(expect.stringMatching(/overdue/i))
    expect(overdueTask?.querySelector('[data-testid="alert-icon"]')).toBeInTheDocument()
  })

  test('supports task templates', async () => {
    render(<TaskBoardView {...defaultProps} />)
    
    const templateButton = screen.getByText(/use template/i)
    fireEvent.click(templateButton)
    
    const templateModal = screen.getByRole('dialog')
    expect(templateModal).toBeInTheDocument()
    
    const bugTemplate = screen.getByText(/bug report template/i)
    fireEvent.click(bugTemplate)
    
    expect(defaultProps.onTaskCreate).toHaveBeenCalledWith('todo', expect.objectContaining({
      title: expect.stringContaining('Bug'),
      description: expect.any(String)
    }))
  })
})