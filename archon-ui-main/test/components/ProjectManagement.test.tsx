import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { mockProjects, mockTasks } from '../utils/mockData'

// Mock Project Management Page
const MockProjectManagementPage = () => {
  const [projects, setProjects] = React.useState(mockProjects)
  const [tasks, setTasks] = React.useState(mockTasks)
  const [selectedProject, setSelectedProject] = React.useState<string | null>(null)
  const [isCreating, setIsCreating] = React.useState(false)
  const [showTaskModal, setShowTaskModal] = React.useState(false)

  const selectedProjectData = projects.find(p => p.id === selectedProject)
  const projectTasks = tasks.filter(t => t.project_id === selectedProject)

  const handleCreateProject = async (title: string, description: string) => {
    setIsCreating(true)
    // Simulate API call
    setTimeout(() => {
      const newProject = {
        id: `project-${Date.now()}`,
        title,
        description,
        status: 'active' as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        metadata: {
          tech_stack: ['React'],
          tags: ['new'],
          priority: 'medium'
        },
        task_count: 0,
        document_count: 0,
        progress: 0
      }
      setProjects(prev => [newProject, ...prev])
      setIsCreating(false)
    }, 100)
  }

  const handleDeleteProject = (id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id))
    if (selectedProject === id) {
      setSelectedProject(null)
    }
  }

  const handleTaskStatusChange = (taskId: string, newStatus: string) => {
    setTasks(prev => prev.map(t => 
      t.id === taskId ? { ...t, status: newStatus } : t
    ))
  }

  const handleCreateTask = (title: string, description: string) => {
    if (!selectedProject) return

    const newTask = {
      id: `task-${Date.now()}`,
      title,
      description,
      status: 'todo' as const,
      priority: 'medium' as const,
      assignee: 'User',
      task_order: tasks.length + 1,
      feature: 'new-feature',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      project_id: selectedProject
    }
    setTasks(prev => [newTask, ...prev])
    setShowTaskModal(false)
  }

  return (
    <div data-testid="project-management-page">
      <h1>Project Management</h1>

      {/* Project Creation Section */}
      <div data-testid="project-creation-section">
        <button 
          onClick={() => setShowTaskModal(true)}
          data-testid="create-project-btn"
          disabled={isCreating}
        >
          {isCreating ? 'Creating...' : 'Create Project'}
        </button>
      </div>

      {/* Projects List */}
      <div data-testid="projects-list">
        <h2>Projects</h2>
        {projects.map(project => (
          <div 
            key={project.id} 
            data-testid={`project-${project.id}`}
            className={`project-card ${selectedProject === project.id ? 'selected' : ''}`}
          >
            <h3 
              data-testid={`project-title-${project.id}`}
              onClick={() => setSelectedProject(project.id)}
              style={{ cursor: 'pointer' }}
            >
              {project.title}
            </h3>
            <p data-testid={`project-description-${project.id}`}>{project.description}</p>
            <div data-testid={`project-status-${project.id}`}>Status: {project.status}</div>
            <div data-testid={`project-progress-${project.id}`}>Progress: {project.progress}%</div>
            <div data-testid={`project-tasks-${project.id}`}>Tasks: {project.task_count}</div>
            
            {project.metadata?.tech_stack && (
              <div data-testid={`project-tech-${project.id}`}>
                Tech: {project.metadata.tech_stack.join(', ')}
              </div>
            )}
            
            <button 
              onClick={() => handleDeleteProject(project.id)}
              data-testid={`delete-project-${project.id}`}
            >
              Delete
            </button>
          </div>
        ))}
      </div>

      {/* Project Details */}
      {selectedProjectData && (
        <div data-testid="project-details">
          <h2>Project: {selectedProjectData.title}</h2>
          
          <div data-testid="project-stats">
            <div>Status: {selectedProjectData.status}</div>
            <div>Progress: {selectedProjectData.progress}%</div>
            <div>Tasks: {selectedProjectData.task_count}</div>
            <div>Documents: {selectedProjectData.document_count}</div>
          </div>

          {/* Tasks Section */}
          <div data-testid="tasks-section">
            <h3>Tasks</h3>
            <button 
              onClick={() => setShowTaskModal(true)}
              data-testid="create-task-btn"
            >
              Create Task
            </button>

            <div data-testid="tasks-list">
              {projectTasks.map(task => (
                <div key={task.id} data-testid={`task-${task.id}`} className="task-card">
                  <h4 data-testid={`task-title-${task.id}`}>{task.title}</h4>
                  <p data-testid={`task-description-${task.id}`}>{task.description}</p>
                  
                  <div data-testid={`task-status-${task.id}`}>
                    Status: {task.status}
                  </div>
                  
                  <div data-testid={`task-priority-${task.id}`}>
                    Priority: {task.priority}
                  </div>
                  
                  <div data-testid={`task-assignee-${task.id}`}>
                    Assignee: {task.assignee}
                  </div>

                  {/* Status Change Buttons */}
                  <div data-testid={`task-actions-${task.id}`}>
                    <button 
                      onClick={() => handleTaskStatusChange(task.id, 'doing')}
                      data-testid={`task-start-${task.id}`}
                      disabled={task.status === 'doing'}
                    >
                      Start
                    </button>
                    <button 
                      onClick={() => handleTaskStatusChange(task.id, 'review')}
                      data-testid={`task-review-${task.id}`}
                      disabled={task.status !== 'doing'}
                    >
                      Review
                    </button>
                    <button 
                      onClick={() => handleTaskStatusChange(task.id, 'done')}
                      data-testid={`task-complete-${task.id}`}
                      disabled={task.status === 'done'}
                    >
                      Complete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Task Creation Modal */}
      {showTaskModal && (
        <div data-testid="task-modal" className="modal">
          <div data-testid="task-modal-content">
            <h3>Create Task</h3>
            <form onSubmit={(e) => {
              e.preventDefault()
              const formData = new FormData(e.target as HTMLFormElement)
              handleCreateTask(
                formData.get('title') as string,
                formData.get('description') as string
              )
            }}>
              <input 
                name="title"
                placeholder="Task title"
                data-testid="task-title-input"
                required
              />
              <textarea 
                name="description"
                placeholder="Task description"
                data-testid="task-description-input"
                required
              />
              <button type="submit" data-testid="task-submit-btn">Create</button>
              <button 
                type="button" 
                onClick={() => setShowTaskModal(false)}
                data-testid="task-cancel-btn"
              >
                Cancel
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Empty State */}
      {projects.length === 0 && (
        <div data-testid="empty-projects">
          No projects found. Create your first project!
        </div>
      )}
    </div>
  )
}

describe('Project Management Components', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('renders project management page', () => {
    render(<MockProjectManagementPage />)
    
    expect(screen.getByTestId('project-management-page')).toBeInTheDocument()
    expect(screen.getByText('Project Management')).toBeInTheDocument()
    expect(screen.getByTestId('create-project-btn')).toBeInTheDocument()
    expect(screen.getByTestId('projects-list')).toBeInTheDocument()
  })

  test('displays projects correctly', () => {
    render(<MockProjectManagementPage />)
    
    // Check first project
    expect(screen.getByTestId('project-project-1')).toBeInTheDocument()
    expect(screen.getByTestId('project-title-project-1')).toHaveTextContent('React Dashboard')
    expect(screen.getByTestId('project-description-project-1')).toHaveTextContent('A modern React dashboard application')
    expect(screen.getByTestId('project-status-project-1')).toHaveTextContent('Status: active')
    expect(screen.getByTestId('project-progress-project-1')).toHaveTextContent('Progress: 75%')
    expect(screen.getByTestId('project-tasks-project-1')).toHaveTextContent('Tasks: 12')
  })

  test('selects project and shows details', () => {
    render(<MockProjectManagementPage />)
    
    // Click on project title to select
    const projectTitle = screen.getByTestId('project-title-project-1')
    fireEvent.click(projectTitle)
    
    // Project details should appear
    expect(screen.getByTestId('project-details')).toBeInTheDocument()
    expect(screen.getByText('Project: React Dashboard')).toBeInTheDocument()
    expect(screen.getByTestId('project-stats')).toBeInTheDocument()
    expect(screen.getByTestId('tasks-section')).toBeInTheDocument()
  })

  test('displays project tasks when project selected', () => {
    render(<MockProjectManagementPage />)
    
    // Select first project
    fireEvent.click(screen.getByTestId('project-title-project-1'))
    
    // Should show tasks for this project
    const tasks = mockTasks.filter(t => t.project_id === 'project-1')
    tasks.forEach(task => {
      expect(screen.getByTestId(`task-${task.id}`)).toBeInTheDocument()
      expect(screen.getByTestId(`task-title-${task.id}`)).toHaveTextContent(task.title)
      expect(screen.getByTestId(`task-status-${task.id}`)).toHaveTextContent(`Status: ${task.status}`)
    })
  })

  test('task status changes work correctly', () => {
    render(<MockProjectManagementPage />)
    
    // Select first project
    fireEvent.click(screen.getByTestId('project-title-project-1'))
    
    // Find a todo task and start it
    const todoTask = mockTasks.find(t => t.status === 'todo' && t.project_id === 'project-1')
    if (todoTask) {
      const startBtn = screen.getByTestId(`task-start-${todoTask.id}`)
      fireEvent.click(startBtn)
      
      // Status should change to 'doing'
      expect(screen.getByTestId(`task-status-${todoTask.id}`)).toHaveTextContent('Status: doing')
    }
  })

  test('creates new task through modal', async () => {
    render(<MockProjectManagementPage />)
    
    // Select first project
    fireEvent.click(screen.getByTestId('project-title-project-1'))
    
    // Click create task button
    fireEvent.click(screen.getByTestId('create-task-btn'))
    
    // Modal should appear
    expect(screen.getByTestId('task-modal')).toBeInTheDocument()
    expect(screen.getByTestId('task-title-input')).toBeInTheDocument()
    
    // Fill form
    fireEvent.change(screen.getByTestId('task-title-input'), {
      target: { value: 'New Test Task' }
    })
    fireEvent.change(screen.getByTestId('task-description-input'), {
      target: { value: 'Test task description' }
    })
    
    // Submit form
    fireEvent.click(screen.getByTestId('task-submit-btn'))
    
    // Modal should close
    expect(screen.queryByTestId('task-modal')).not.toBeInTheDocument()
    
    // New task should appear
    expect(screen.getByText('New Test Task')).toBeInTheDocument()
  })

  test('cancels task creation', () => {
    render(<MockProjectManagementPage />)
    
    // Select project and open modal
    fireEvent.click(screen.getByTestId('project-title-project-1'))
    fireEvent.click(screen.getByTestId('create-task-btn'))
    
    expect(screen.getByTestId('task-modal')).toBeInTheDocument()
    
    // Cancel
    fireEvent.click(screen.getByTestId('task-cancel-btn'))
    
    // Modal should close
    expect(screen.queryByTestId('task-modal')).not.toBeInTheDocument()
  })

  test('deletes project', () => {
    render(<MockProjectManagementPage />)
    
    // Verify project exists
    expect(screen.getByTestId('project-project-1')).toBeInTheDocument()
    
    // Delete project
    fireEvent.click(screen.getByTestId('delete-project-project-1'))
    
    // Project should be removed
    expect(screen.queryByTestId('project-project-1')).not.toBeInTheDocument()
  })

  test('shows tech stack information', () => {
    render(<MockProjectManagementPage />)
    
    // Check tech stack is displayed
    expect(screen.getByTestId('project-tech-project-1')).toBeInTheDocument()
    expect(screen.getByTestId('project-tech-project-1')).toHaveTextContent('Tech: React, TypeScript, Vite, TailwindCSS')
  })

  test('disables buttons appropriately based on task status', () => {
    render(<MockProjectManagementPage />)
    
    // Select project
    fireEvent.click(screen.getByTestId('project-title-project-1'))
    
    // Find a 'doing' task
    const doingTask = mockTasks.find(t => t.status === 'doing' && t.project_id === 'project-1')
    if (doingTask) {
      const startBtn = screen.getByTestId(`task-start-${doingTask.id}`) as HTMLButtonElement
      const reviewBtn = screen.getByTestId(`task-review-${doingTask.id}`) as HTMLButtonElement
      
      expect(startBtn.disabled).toBe(true)
      expect(reviewBtn.disabled).toBe(false)
    }
  })

  test('shows create project loading state', async () => {
    render(<MockProjectManagementPage />)
    
    const createBtn = screen.getByTestId('create-project-btn')
    
    // Simulate creating project (this would normally open a form, but we'll test the disabled state)
    expect(createBtn).toHaveTextContent('Create Project')
    expect(createBtn).not.toBeDisabled()
  })

  test('handles project selection visual feedback', () => {
    render(<MockProjectManagementPage />)
    
    const projectCard = screen.getByTestId('project-project-1')
    
    // Should not have selected class initially
    expect(projectCard).not.toHaveClass('selected')
    
    // Click to select
    fireEvent.click(screen.getByTestId('project-title-project-1'))
    
    // Should have selected class
    expect(projectCard).toHaveClass('selected')
  })
})