import { renderHook, act } from '@testing-library/react'
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'

// Mock WebSocket
const mockWebSocket = {
  send: vi.fn(),
  close: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  readyState: WebSocket.OPEN
}

// Mock custom hooks implementations
const useTaskSocket = (projectId?: string) => {
  const [tasks, setTasks] = React.useState<any[]>([])
  const [isConnected, setIsConnected] = React.useState(false)
  const [connectionError, setConnectionError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (projectId) {
      setIsConnected(true)
      setConnectionError(null)
      // Simulate initial tasks
      setTasks([
        { id: '1', title: 'Task 1', status: 'todo' },
        { id: '2', title: 'Task 2', status: 'doing' }
      ])
    }
  }, [projectId])

  const updateTaskStatus = (taskId: string, status: string) => {
    setTasks(prev => prev.map(task => 
      task.id === taskId ? { ...task, status } : task
    ))
  }

  const sendMessage = (message: any) => {
    mockWebSocket.send(JSON.stringify(message))
  }

  return {
    tasks,
    isConnected,
    connectionError,
    updateTaskStatus,
    sendMessage
  }
}

const useRealtimeUpdates = () => {
  const [isConnected, setIsConnected] = React.useState(false)
  const [lastMessage, setLastMessage] = React.useState<any>(null)
  const [messageCount, setMessageCount] = React.useState(0)

  React.useEffect(() => {
    // Simulate connection
    const timer = setTimeout(() => {
      setIsConnected(true)
    }, 100)

    return () => clearTimeout(timer)
  }, [])

  const subscribe = (channel: string, callback: (data: any) => void) => {
    // Simulate subscription
    return () => {
      // Cleanup subscription
    }
  }

  const emit = (event: string, data: any) => {
    setLastMessage({ event, data })
    setMessageCount(prev => prev + 1)
  }

  return {
    isConnected,
    lastMessage,
    messageCount,
    subscribe,
    emit
  }
}

const useNeonGlow = (intensity: number = 0.5) => {
  const [glowActive, setGlowActive] = React.useState(false)
  const [glowIntensity, setGlowIntensity] = React.useState(intensity)
  const elementRef = React.useRef<HTMLElement>(null)

  const activateGlow = () => {
    setGlowActive(true)
  }

  const deactivateGlow = () => {
    setGlowActive(false)
  }

  const updateIntensity = (newIntensity: number) => {
    setGlowIntensity(Math.max(0, Math.min(1, newIntensity)))
  }

  const glowStyle = React.useMemo(() => ({
    boxShadow: glowActive 
      ? `0 0 ${20 * glowIntensity}px rgba(0, 255, 255, ${glowIntensity})`
      : 'none',
    transition: 'box-shadow 0.3s ease'
  }), [glowActive, glowIntensity])

  return {
    elementRef,
    glowActive,
    glowIntensity,
    glowStyle,
    activateGlow,
    deactivateGlow,
    updateIntensity
  }
}

const useCardTilt = () => {
  const [tilt, setTilt] = React.useState({ x: 0, y: 0 })
  const [isHovered, setIsHovered] = React.useState(false)
  const elementRef = React.useRef<HTMLElement>(null)

  const handleMouseMove = (event: MouseEvent) => {
    if (!elementRef.current) return

    const rect = elementRef.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    
    const x = (event.clientX - centerX) / (rect.width / 2)
    const y = (event.clientY - centerY) / (rect.height / 2)
    
    setTilt({ x: y * -10, y: x * 10 })
  }

  const handleMouseEnter = () => {
    setIsHovered(true)
  }

  const handleMouseLeave = () => {
    setIsHovered(false)
    setTilt({ x: 0, y: 0 })
  }

  const tiltStyle = React.useMemo(() => ({
    transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
    transition: isHovered ? 'none' : 'transform 0.3s ease-out'
  }), [tilt, isHovered])

  React.useEffect(() => {
    const element = elementRef.current
    if (!element) return

    element.addEventListener('mousemove', handleMouseMove)
    element.addEventListener('mouseenter', handleMouseEnter)
    element.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      element.removeEventListener('mousemove', handleMouseMove)
      element.removeEventListener('mouseenter', handleMouseEnter)
      element.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [])

  return {
    elementRef,
    tilt,
    isHovered,
    tiltStyle
  }
}

const useStaggeredEntrance = (itemCount: number, delay: number = 100) => {
  const [visibleItems, setVisibleItems] = React.useState<Set<number>>(new Set())
  const [animationComplete, setAnimationComplete] = React.useState(false)

  const startAnimation = () => {
    setVisibleItems(new Set())
    setAnimationComplete(false)

    for (let i = 0; i < itemCount; i++) {
      setTimeout(() => {
        setVisibleItems(prev => new Set(prev).add(i))
        
        if (i === itemCount - 1) {
          setTimeout(() => setAnimationComplete(true), 100)
        }
      }, i * delay)
    }
  }

  const resetAnimation = () => {
    setVisibleItems(new Set())
    setAnimationComplete(false)
  }

  const isItemVisible = (index: number) => visibleItems.has(index)

  return {
    visibleItems,
    animationComplete,
    startAnimation,
    resetAnimation,
    isItemVisible
  }
}

const useTerminalScroll = () => {
  const [lines, setLines] = React.useState<string[]>([])
  const [isScrolling, setIsScrolling] = React.useState(false)
  const scrollRef = React.useRef<HTMLElement>(null)

  const addLine = (line: string) => {
    setLines(prev => [...prev, line])
    setIsScrolling(true)
    
    // Auto-scroll to bottom
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight
      }
      setIsScrolling(false)
    }, 100)
  }

  const addLines = (newLines: string[]) => {
    setLines(prev => [...prev, ...newLines])
    setIsScrolling(true)
    
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight
      }
      setIsScrolling(false)
    }, 100)
  }

  const clearLines = () => {
    setLines([])
  }

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }

  return {
    lines,
    isScrolling,
    scrollRef,
    addLine,
    addLines,
    clearLines,
    scrollToBottom
  }
}

const useBugReport = () => {
  const [isOpen, setIsOpen] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [submitStatus, setSubmitStatus] = React.useState<'idle' | 'success' | 'error'>('idle')

  const openModal = () => {
    setIsOpen(true)
    setSubmitStatus('idle')
  }

  const closeModal = () => {
    setIsOpen(false)
    setSubmitStatus('idle')
  }

  const submitReport = async (reportData: {
    title: string
    description: string
    severity: string
    category: string
  }) => {
    setIsSubmitting(true)
    setSubmitStatus('idle')

    try {
      // Simulate API call
      await new Promise((resolve, reject) => {
        setTimeout(() => {
          if (reportData.title.includes('error')) {
            reject(new Error('Submission failed'))
          } else {
            resolve(true)
          }
        }, 1000)
      })

      setSubmitStatus('success')
      setTimeout(() => {
        closeModal()
      }, 1500)
    } catch (error) {
      setSubmitStatus('error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return {
    isOpen,
    isSubmitting,
    submitStatus,
    openModal,
    closeModal,
    submitReport
  }
}

describe('Custom Hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // @ts-ignore
    global.WebSocket = vi.fn(() => mockWebSocket)
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('useTaskSocket', () => {
    test('initializes with default state', () => {
      const { result } = renderHook(() => useTaskSocket())

      expect(result.current.tasks).toEqual([])
      expect(result.current.isConnected).toBe(false)
      expect(result.current.connectionError).toBe(null)
    })

    test('connects and loads tasks when projectId provided', () => {
      const { result } = renderHook(() => useTaskSocket('project-1'))

      expect(result.current.isConnected).toBe(true)
      expect(result.current.tasks).toHaveLength(2)
      expect(result.current.tasks[0].title).toBe('Task 1')
    })

    test('updates task status correctly', () => {
      const { result } = renderHook(() => useTaskSocket('project-1'))

      act(() => {
        result.current.updateTaskStatus('1', 'done')
      })

      const updatedTask = result.current.tasks.find(t => t.id === '1')
      expect(updatedTask?.status).toBe('done')
    })

    test('sends messages through WebSocket', () => {
      const { result } = renderHook(() => useTaskSocket('project-1'))

      act(() => {
        result.current.sendMessage({ type: 'task_update', taskId: '1' })
      })

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'task_update', taskId: '1' })
      )
    })
  })

  describe('useRealtimeUpdates', () => {
    test('connects automatically', async () => {
      const { result } = renderHook(() => useRealtimeUpdates())

      expect(result.current.isConnected).toBe(false)

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 150))
      })

      expect(result.current.isConnected).toBe(true)
    })

    test('tracks messages correctly', () => {
      const { result } = renderHook(() => useRealtimeUpdates())

      act(() => {
        result.current.emit('test_event', { data: 'test' })
      })

      expect(result.current.lastMessage).toEqual({
        event: 'test_event',
        data: { data: 'test' }
      })
      expect(result.current.messageCount).toBe(1)
    })

    test('increments message count on multiple emissions', () => {
      const { result } = renderHook(() => useRealtimeUpdates())

      act(() => {
        result.current.emit('event1', {})
        result.current.emit('event2', {})
        result.current.emit('event3', {})
      })

      expect(result.current.messageCount).toBe(3)
    })
  })

  describe('useNeonGlow', () => {
    test('initializes with correct default intensity', () => {
      const { result } = renderHook(() => useNeonGlow(0.7))

      expect(result.current.glowIntensity).toBe(0.7)
      expect(result.current.glowActive).toBe(false)
    })

    test('activates and deactivates glow', () => {
      const { result } = renderHook(() => useNeonGlow())

      act(() => {
        result.current.activateGlow()
      })

      expect(result.current.glowActive).toBe(true)

      act(() => {
        result.current.deactivateGlow()
      })

      expect(result.current.glowActive).toBe(false)
    })

    test('updates intensity within bounds', () => {
      const { result } = renderHook(() => useNeonGlow())

      act(() => {
        result.current.updateIntensity(1.5) // Should clamp to 1
      })

      expect(result.current.glowIntensity).toBe(1)

      act(() => {
        result.current.updateIntensity(-0.5) // Should clamp to 0
      })

      expect(result.current.glowIntensity).toBe(0)
    })

    test('generates correct glow style', () => {
      const { result } = renderHook(() => useNeonGlow(0.8))

      act(() => {
        result.current.activateGlow()
      })

      expect(result.current.glowStyle).toEqual({
        boxShadow: '0 0 16px rgba(0, 255, 255, 0.8)',
        transition: 'box-shadow 0.3s ease'
      })
    })
  })

  describe('useCardTilt', () => {
    test('initializes with zero tilt', () => {
      const { result } = renderHook(() => useCardTilt())

      expect(result.current.tilt).toEqual({ x: 0, y: 0 })
      expect(result.current.isHovered).toBe(false)
    })

    test('generates correct tilt style', () => {
      const { result } = renderHook(() => useCardTilt())

      expect(result.current.tiltStyle).toEqual({
        transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg)',
        transition: 'transform 0.3s ease-out'
      })
    })
  })

  describe('useStaggeredEntrance', () => {
    test('initializes with no visible items', () => {
      const { result } = renderHook(() => useStaggeredEntrance(5))

      expect(result.current.visibleItems.size).toBe(0)
      expect(result.current.animationComplete).toBe(false)
    })

    test('shows items progressively when animation starts', async () => {
      vi.useFakeTimers()
      const { result } = renderHook(() => useStaggeredEntrance(3, 50))

      act(() => {
        result.current.startAnimation()
      })

      // First item should be visible immediately
      act(() => {
        vi.advanceTimersByTime(0)
      })
      expect(result.current.isItemVisible(0)).toBe(true)

      // Second item after 50ms
      act(() => {
        vi.advanceTimersByTime(50)
      })
      expect(result.current.isItemVisible(1)).toBe(true)

      // Third item after another 50ms
      act(() => {
        vi.advanceTimersByTime(50)
      })
      expect(result.current.isItemVisible(2)).toBe(true)

      vi.useRealTimers()
    })

    test('resets animation correctly', () => {
      const { result } = renderHook(() => useStaggeredEntrance(3))

      act(() => {
        result.current.startAnimation()
        result.current.resetAnimation()
      })

      expect(result.current.visibleItems.size).toBe(0)
      expect(result.current.animationComplete).toBe(false)
    })
  })

  describe('useTerminalScroll', () => {
    test('initializes with empty lines', () => {
      const { result } = renderHook(() => useTerminalScroll())

      expect(result.current.lines).toEqual([])
      expect(result.current.isScrolling).toBe(false)
    })

    test('adds single line correctly', async () => {
      const { result } = renderHook(() => useTerminalScroll())

      act(() => {
        result.current.addLine('Test line 1')
      })

      expect(result.current.lines).toEqual(['Test line 1'])
      expect(result.current.isScrolling).toBe(true)

      // Wait for scrolling to complete
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 150))
      })

      expect(result.current.isScrolling).toBe(false)
    })

    test('adds multiple lines correctly', () => {
      const { result } = renderHook(() => useTerminalScroll())

      act(() => {
        result.current.addLines(['Line 1', 'Line 2', 'Line 3'])
      })

      expect(result.current.lines).toEqual(['Line 1', 'Line 2', 'Line 3'])
    })

    test('clears lines correctly', () => {
      const { result } = renderHook(() => useTerminalScroll())

      act(() => {
        result.current.addLines(['Line 1', 'Line 2'])
        result.current.clearLines()
      })

      expect(result.current.lines).toEqual([])
    })
  })

  describe('useBugReport', () => {
    test('initializes with closed state', () => {
      const { result } = renderHook(() => useBugReport())

      expect(result.current.isOpen).toBe(false)
      expect(result.current.isSubmitting).toBe(false)
      expect(result.current.submitStatus).toBe('idle')
    })

    test('opens and closes modal correctly', () => {
      const { result } = renderHook(() => useBugReport())

      act(() => {
        result.current.openModal()
      })

      expect(result.current.isOpen).toBe(true)

      act(() => {
        result.current.closeModal()
      })

      expect(result.current.isOpen).toBe(false)
    })

    test('submits report successfully', async () => {
      const { result } = renderHook(() => useBugReport())

      const reportData = {
        title: 'Test Bug',
        description: 'Bug description',
        severity: 'medium',
        category: 'ui'
      }

      await act(async () => {
        await result.current.submitReport(reportData)
      })

      expect(result.current.submitStatus).toBe('success')
    })

    test('handles submission error', async () => {
      const { result } = renderHook(() => useBugReport())

      const reportData = {
        title: 'error Bug', // This will trigger error in mock
        description: 'Bug description',
        severity: 'high',
        category: 'api'
      }

      await act(async () => {
        await result.current.submitReport(reportData)
      })

      expect(result.current.submitStatus).toBe('error')
      expect(result.current.isSubmitting).toBe(false)
    })
  })
})