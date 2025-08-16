import { KnowledgeItem, Project, Task, User } from '@/types'

// Knowledge Base Mock Data
export const mockKnowledgeItems: KnowledgeItem[] = [
  {
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
      tags: ['react', 'documentation', 'frontend'],
      crawl_depth: 2,
      last_crawl: '2024-01-01T00:00:00Z'
    }
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
    metadata: {
      description: 'TypeScript language handbook',
      tags: ['typescript', 'documentation', 'javascript'],
      crawl_depth: 1,
      progress: 60
    }
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
    metadata: {
      description: 'Internal API documentation',
      error: 'Failed to parse PDF: Invalid format',
      file_size: 2048576,
      file_type: 'application/pdf'
    }
  },
  {
    id: '4',
    title: 'Next.js Documentation',
    url: 'https://nextjs.org/docs',
    source_type: 'url',
    status: 'processed',
    created_at: '2024-01-04T00:00:00Z',
    updated_at: '2024-01-04T00:00:00Z',
    document_count: 23,
    metadata: {
      description: 'Next.js framework documentation',
      tags: ['nextjs', 'react', 'ssr', 'documentation'],
      crawl_depth: 3,
      last_crawl: '2024-01-04T00:00:00Z'
    }
  },
  {
    id: '5',
    title: 'Design System Guidelines',
    url: 'design-system.docx',
    source_type: 'upload',
    status: 'processed',
    created_at: '2024-01-05T00:00:00Z',
    updated_at: '2024-01-05T00:00:00Z',
    document_count: 7,
    metadata: {
      description: 'Company design system guidelines',
      tags: ['design', 'ui', 'guidelines'],
      file_size: 1024000,
      file_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    }
  }
]

// Project Mock Data
export const mockProjects: Project[] = [
  {
    id: 'project-1',
    title: 'React Dashboard',
    description: 'A modern React dashboard application with real-time analytics',
    status: 'active',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z',
    metadata: {
      github_repo: 'https://github.com/company/react-dashboard',
      tech_stack: ['React', 'TypeScript', 'Vite', 'TailwindCSS'],
      tags: ['frontend', 'dashboard', 'analytics'],
      priority: 'high'
    },
    task_count: 12,
    document_count: 5,
    progress: 75
  },
  {
    id: 'project-2',
    title: 'API Gateway Service',
    description: 'Microservices API gateway with authentication and rate limiting',
    status: 'active',
    created_at: '2024-01-05T00:00:00Z',
    updated_at: '2024-01-20T00:00:00Z',
    metadata: {
      github_repo: 'https://github.com/company/api-gateway',
      tech_stack: ['Node.js', 'Express', 'Redis', 'PostgreSQL'],
      tags: ['backend', 'microservices', 'api'],
      priority: 'medium'
    },
    task_count: 8,
    document_count: 3,
    progress: 45
  },
  {
    id: 'project-3',
    title: 'Mobile App',
    description: 'Cross-platform mobile application for iOS and Android',
    status: 'completed',
    created_at: '2023-12-01T00:00:00Z',
    updated_at: '2024-01-10T00:00:00Z',
    metadata: {
      github_repo: 'https://github.com/company/mobile-app',
      tech_stack: ['React Native', 'TypeScript', 'Expo'],
      tags: ['mobile', 'ios', 'android'],
      priority: 'high'
    },
    task_count: 25,
    document_count: 8,
    progress: 100
  },
  {
    id: 'project-4',
    title: 'E-commerce Platform',
    description: 'Full-stack e-commerce platform with payment integration',
    status: 'archived',
    created_at: '2023-10-01T00:00:00Z',
    updated_at: '2023-12-15T00:00:00Z',
    metadata: {
      github_repo: 'https://github.com/company/ecommerce',
      tech_stack: ['Vue.js', 'Nuxt.js', 'Laravel', 'MySQL'],
      tags: ['ecommerce', 'fullstack', 'payments'],
      priority: 'low'
    },
    task_count: 45,
    document_count: 15,
    progress: 85
  }
]

// Task Mock Data
export const mockTasks: Task[] = [
  {
    id: 'task-1',
    title: 'Implement OAuth2 authentication',
    description: 'Add secure OAuth2 authentication with Google and GitHub providers',
    status: 'todo',
    priority: 'high',
    assignee: 'AI IDE Agent',
    task_order: 1,
    feature: 'authentication',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    project_id: 'project-1',
    due_date: '2024-02-01T00:00:00Z',
    sources: [
      { url: 'https://oauth.net/2/', type: 'documentation', relevance: 'OAuth2 specification' },
      { url: 'https://developers.google.com/identity', type: 'documentation', relevance: 'Google OAuth setup' }
    ],
    code_examples: [
      { file: 'auth/oauth.js', function: 'createOAuthProvider', purpose: 'OAuth provider setup' }
    ]
  },
  {
    id: 'task-2',
    title: 'Setup database schema',
    description: 'Create database tables for users, sessions, and OAuth tokens',
    status: 'doing',
    priority: 'medium',
    assignee: 'User',
    task_order: 2,
    feature: 'database',
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-10T00:00:00Z',
    project_id: 'project-1',
    sources: [
      { url: 'database/schema.sql', type: 'internal_docs', relevance: 'Current schema' }
    ]
  },
  {
    id: 'task-3',
    title: 'Create user dashboard UI',
    description: 'Design and implement responsive dashboard interface',
    status: 'review',
    priority: 'high',
    assignee: 'prp-validator',
    task_order: 3,
    feature: 'frontend',
    created_at: '2024-01-03T00:00:00Z',
    updated_at: '2024-01-18T00:00:00Z',
    project_id: 'project-1',
    due_date: '2024-01-25T00:00:00Z',
    sources: [
      { url: 'figma.com/dashboard-design', type: 'design', relevance: 'UI mockups' }
    ],
    code_examples: [
      { file: 'components/Dashboard.tsx', function: 'Dashboard', purpose: 'Main dashboard component' }
    ]
  },
  {
    id: 'task-4',
    title: 'Write unit tests',
    description: 'Add comprehensive test coverage for authentication module',
    status: 'done',
    priority: 'medium',
    assignee: 'archon-task-manager',
    task_order: 4,
    feature: 'testing',
    created_at: '2024-01-04T00:00:00Z',
    updated_at: '2024-01-20T00:00:00Z',
    project_id: 'project-1',
    code_examples: [
      { file: 'tests/auth.test.js', function: 'testOAuthFlow', purpose: 'OAuth flow testing' }
    ]
  },
  {
    id: 'task-5',
    title: 'API rate limiting',
    description: 'Implement Redis-based rate limiting for API endpoints',
    status: 'todo',
    priority: 'low',
    assignee: 'AI IDE Agent',
    task_order: 5,
    feature: 'api',
    created_at: '2024-01-05T00:00:00Z',
    updated_at: '2024-01-05T00:00:00Z',
    project_id: 'project-2',
    sources: [
      { url: 'https://redis.io/docs/manual/patterns/rate-limiting/', type: 'documentation', relevance: 'Redis rate limiting patterns' }
    ]
  }
]

// User Mock Data
export const mockUsers: User[] = [
  {
    id: 'user-1',
    username: 'john.doe',
    email: 'john.doe@company.com',
    full_name: 'John Doe',
    role: 'developer',
    avatar_url: 'https://avatars.example.com/john',
    created_at: '2024-01-01T00:00:00Z',
    last_login: '2024-01-20T00:00:00Z',
    settings: {
      notifications: true,
      theme: 'dark',
      language: 'en'
    }
  },
  {
    id: 'user-2',
    username: 'jane.smith',
    email: 'jane.smith@company.com',
    full_name: 'Jane Smith',
    role: 'admin',
    avatar_url: 'https://avatars.example.com/jane',
    created_at: '2024-01-01T00:00:00Z',
    last_login: '2024-01-21T00:00:00Z',
    settings: {
      notifications: true,
      theme: 'light',
      language: 'en'
    }
  }
]

// API Response Mock Data
export const mockApiResponses = {
  knowledgeItems: {
    list: {
      knowledge_items: mockKnowledgeItems,
      total: mockKnowledgeItems.length,
      page: 1,
      per_page: 20
    },
    single: {
      knowledge_item: mockKnowledgeItems[0]
    },
    created: {
      knowledge_item: mockKnowledgeItems[0],
      message: 'Knowledge item created successfully'
    },
    updated: {
      knowledge_item: { ...mockKnowledgeItems[0], title: 'Updated Title' },
      message: 'Knowledge item updated successfully'
    },
    deleted: {
      message: 'Knowledge item deleted successfully'
    }
  },
  
  projects: {
    list: {
      projects: mockProjects,
      total: mockProjects.length,
      page: 1,
      per_page: 20
    },
    single: {
      project: mockProjects[0],
      tasks: mockTasks.filter(task => task.project_id === 'project-1'),
      documents: []
    },
    created: {
      project: mockProjects[0],
      message: 'Project created successfully'
    },
    updated: {
      project: { ...mockProjects[0], title: 'Updated Project' },
      message: 'Project updated successfully'
    },
    deleted: {
      message: 'Project deleted successfully'
    }
  },
  
  tasks: {
    list: {
      tasks: mockTasks,
      total: mockTasks.length,
      page: 1,
      per_page: 20
    },
    single: {
      task: mockTasks[0]
    },
    created: {
      task: mockTasks[0],
      message: 'Task created successfully'
    },
    updated: {
      task: { ...mockTasks[0], status: 'doing' },
      message: 'Task updated successfully'
    },
    deleted: {
      message: 'Task deleted successfully'
    }
  }
}

// Mock WebSocket Events
export const mockSocketEvents = {
  crawl_progress: {
    id: '1',
    progress: 75,
    status: 'processing',
    current_url: 'https://react.dev/learn',
    total_pages: 20,
    processed_pages: 15
  },
  
  project_creation_progress: {
    project_id: 'project-1',
    stage: 'creating_tasks',
    progress: 60,
    message: 'Creating project tasks...'
  },
  
  task_update: {
    task_id: 'task-1',
    status: 'doing',
    assignee: 'AI IDE Agent',
    updated_at: new Date().toISOString()
  },
  
  knowledge_update: {
    knowledge_item_id: '1',
    status: 'processed',
    document_count: 15,
    updated_at: new Date().toISOString()
  }
}

// Mock Error Responses
export const mockErrorResponses = {
  validation: {
    error: 'Validation failed',
    details: {
      title: 'Title is required',
      url: 'Invalid URL format'
    }
  },
  
  notFound: {
    error: 'Resource not found',
    message: 'The requested resource could not be found'
  },
  
  unauthorized: {
    error: 'Unauthorized',
    message: 'You are not authorized to perform this action'
  },
  
  serverError: {
    error: 'Internal server error',
    message: 'An unexpected error occurred'
  },
  
  rateLimit: {
    error: 'Rate limit exceeded',
    message: 'Too many requests. Please try again later.',
    retry_after: 60
  }
}

// Mock Settings/Configuration Data
export const mockSettings = {
  api_keys: {
    openai: 'sk-test1234567890abcdef',
    anthropic: 'sk-ant-test1234567890',
    google: 'AIzaSyTest1234567890',
    groq: 'gsk_test1234567890abcdef'
  },
  
  features: {
    projects_enabled: true,
    knowledge_base_enabled: true,
    mcp_enabled: true,
    notifications_enabled: true
  },
  
  rag_settings: {
    chunk_size: 1000,
    chunk_overlap: 200,
    similarity_threshold: 0.7,
    max_results: 10
  },
  
  extraction_settings: {
    max_depth: 3,
    respect_robots_txt: true,
    delay_between_requests: 1000,
    timeout: 30000
  }
}

// Test Scenarios
export const testScenarios = {
  // Empty states
  emptyKnowledgeBase: {
    knowledge_items: [],
    total: 0,
    page: 1,
    per_page: 20
  },
  
  emptyProjects: {
    projects: [],
    total: 0,
    page: 1,
    per_page: 20
  },
  
  // Loading states
  loadingKnowledgeItems: mockKnowledgeItems.map(item => ({
    ...item,
    status: 'processing'
  })),
  
  // Error states
  failedKnowledgeItems: mockKnowledgeItems.map(item => ({
    ...item,
    status: 'failed',
    metadata: {
      ...item.metadata,
      error: 'Processing failed'
    }
  })),
  
  // Large datasets for pagination testing
  largeKnowledgeItemsSet: Array.from({ length: 100 }, (_, index) => ({
    ...mockKnowledgeItems[0],
    id: `knowledge-${index + 1}`,
    title: `Knowledge Item ${index + 1}`,
    created_at: new Date(Date.now() - index * 86400000).toISOString()
  })),
  
  largeProjectsSet: Array.from({ length: 50 }, (_, index) => ({
    ...mockProjects[0],
    id: `project-${index + 1}`,
    title: `Project ${index + 1}`,
    created_at: new Date(Date.now() - index * 86400000).toISOString()
  }))
}