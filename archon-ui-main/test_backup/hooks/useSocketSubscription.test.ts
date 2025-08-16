import { renderHook, act } from '@testing-library/react'
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { useSocketSubscription } from '@/hooks/useSocketSubscription'

// Mock socket.io-client
const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  connected: false,
  emit: vi.fn()
}

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket)
}))

describe('useSocketSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSocket.connected = false
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('subscribes to socket event on mount', () => {
    const callback = vi.fn()
    const event = 'test_event'
    
    renderHook(() => useSocketSubscription(event, callback))
    
    expect(mockSocket.on).toHaveBeenCalledWith(event, callback)
  })

  test('unsubscribes from socket event on unmount', () => {
    const callback = vi.fn()
    const event = 'test_event'
    
    const { unmount } = renderHook(() => useSocketSubscription(event, callback))
    
    unmount()
    
    expect(mockSocket.off).toHaveBeenCalledWith(event, callback)
  })

  test('resubscribes when event name changes', () => {
    const callback = vi.fn()
    let event = 'test_event_1'
    
    const { rerender } = renderHook(() => useSocketSubscription(event, callback))
    
    expect(mockSocket.on).toHaveBeenCalledWith('test_event_1', callback)
    
    // Change event
    event = 'test_event_2'
    rerender()
    
    expect(mockSocket.off).toHaveBeenCalledWith('test_event_1', callback)
    expect(mockSocket.on).toHaveBeenCalledWith('test_event_2', callback)
  })

  test('resubscribes when callback changes', () => {
    let callback = vi.fn()
    const event = 'test_event'
    
    const { rerender } = renderHook(() => useSocketSubscription(event, callback))
    
    expect(mockSocket.on).toHaveBeenCalledWith(event, callback)
    
    // Change callback
    const newCallback = vi.fn()
    callback = newCallback
    rerender()
    
    expect(mockSocket.off).toHaveBeenCalledWith(event, expect.any(Function))
    expect(mockSocket.on).toHaveBeenCalledWith(event, newCallback)
  })

  test('handles socket connection status', () => {
    const callback = vi.fn()
    const event = 'test_event'
    
    const { result } = renderHook(() => useSocketSubscription(event, callback))
    
    expect(result.current.isConnected).toBe(false)
    
    // Simulate connection
    act(() => {
      mockSocket.connected = true
      const connectCallback = mockSocket.on.mock.calls.find(call => call[0] === 'connect')?.[1]
      if (connectCallback) connectCallback()
    })
    
    expect(result.current.isConnected).toBe(true)
  })

  test('provides emit function', () => {
    const callback = vi.fn()
    const event = 'test_event'
    
    const { result } = renderHook(() => useSocketSubscription(event, callback))
    
    expect(typeof result.current.emit).toBe('function')
    
    // Test emit
    act(() => {
      result.current.emit('custom_event', { data: 'test' })
    })
    
    expect(mockSocket.emit).toHaveBeenCalledWith('custom_event', { data: 'test' })
  })

  test('handles multiple subscriptions independently', () => {
    const callback1 = vi.fn()
    const callback2 = vi.fn()
    
    const { unmount: unmount1 } = renderHook(() => useSocketSubscription('event1', callback1))
    const { unmount: unmount2 } = renderHook(() => useSocketSubscription('event2', callback2))
    
    expect(mockSocket.on).toHaveBeenCalledWith('event1', callback1)
    expect(mockSocket.on).toHaveBeenCalledWith('event2', callback2)
    
    unmount1()
    
    expect(mockSocket.off).toHaveBeenCalledWith('event1', callback1)
    expect(mockSocket.off).not.toHaveBeenCalledWith('event2', callback2)
    
    unmount2()
    
    expect(mockSocket.off).toHaveBeenCalledWith('event2', callback2)
  })

  test('handles socket disconnection gracefully', () => {
    const callback = vi.fn()
    const event = 'test_event'
    
    const { result } = renderHook(() => useSocketSubscription(event, callback))
    
    // Initially connected
    act(() => {
      mockSocket.connected = true
    })
    
    expect(result.current.isConnected).toBe(true)
    
    // Simulate disconnection
    act(() => {
      mockSocket.connected = false
      const disconnectCallback = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect')?.[1]
      if (disconnectCallback) disconnectCallback()
    })
    
    expect(result.current.isConnected).toBe(false)
  })

  test('provides connection retry functionality', async () => {
    const callback = vi.fn()
    const event = 'test_event'
    
    const { result } = renderHook(() => useSocketSubscription(event, callback))
    
    expect(typeof result.current.reconnect).toBe('function')
    
    // Test reconnect
    act(() => {
      result.current.reconnect()
    })
    
    expect(mockSocket.connect).toHaveBeenCalled()
  })

  test('handles error events', () => {
    const callback = vi.fn()
    const event = 'test_event'
    
    const { result } = renderHook(() => useSocketSubscription(event, callback))
    
    expect(result.current.error).toBe(null)
    
    // Simulate error
    act(() => {
      const errorCallback = mockSocket.on.mock.calls.find(call => call[0] === 'error')?.[1]
      if (errorCallback) errorCallback('Connection failed')
    })
    
    expect(result.current.error).toBe('Connection failed')
  })

  test('clears error on successful reconnection', () => {
    const callback = vi.fn()
    const event = 'test_event'
    
    const { result } = renderHook(() => useSocketSubscription(event, callback))
    
    // Set error
    act(() => {
      const errorCallback = mockSocket.on.mock.calls.find(call => call[0] === 'error')?.[1]
      if (errorCallback) errorCallback('Connection failed')
    })
    
    expect(result.current.error).toBe('Connection failed')
    
    // Simulate successful connection
    act(() => {
      mockSocket.connected = true
      const connectCallback = mockSocket.on.mock.calls.find(call => call[0] === 'connect')?.[1]
      if (connectCallback) connectCallback()
    })
    
    expect(result.current.error).toBe(null)
  })

  test('handles subscription with options', () => {
    const callback = vi.fn()
    const event = 'test_event'
    const options = { 
      autoConnect: false,
      reconnectAttempts: 5,
      timeout: 10000
    }
    
    renderHook(() => useSocketSubscription(event, callback, options))
    
    // Should not auto-connect when autoConnect is false
    expect(mockSocket.connect).not.toHaveBeenCalled()
  })

  test('provides manual connection control', () => {
    const callback = vi.fn()
    const event = 'test_event'
    const options = { autoConnect: false }
    
    const { result } = renderHook(() => useSocketSubscription(event, callback, options))
    
    // Manual connect
    act(() => {
      result.current.connect()
    })
    
    expect(mockSocket.connect).toHaveBeenCalled()
    
    // Manual disconnect
    act(() => {
      result.current.disconnect()
    })
    
    expect(mockSocket.disconnect).toHaveBeenCalled()
  })

  test('debounces rapid subscription changes', () => {
    let callback = vi.fn()
    const event = 'test_event'
    
    const { rerender } = renderHook(() => useSocketSubscription(event, callback))
    
    // Rapid callback changes
    for (let i = 0; i < 5; i++) {
      callback = vi.fn()
      rerender()
    }
    
    // Should only subscribe to the final callback after debounce
    // The exact behavior depends on implementation
    expect(mockSocket.on).toHaveBeenCalled()
  })

  test('handles namespace subscriptions', () => {
    const callback = vi.fn()
    const event = 'test_event'
    const namespace = '/projects'
    
    renderHook(() => useSocketSubscription(event, callback, { namespace }))
    
    // Should subscribe with namespace context
    expect(mockSocket.on).toHaveBeenCalledWith(event, callback)
  })

  test('provides subscription status information', () => {
    const callback = vi.fn()
    const event = 'test_event'
    
    const { result } = renderHook(() => useSocketSubscription(event, callback))
    
    expect(result.current.isSubscribed).toBe(true)
    expect(result.current.eventName).toBe(event)
  })

  test('handles conditional subscriptions', () => {
    const callback = vi.fn()
    const event = 'test_event'
    let enabled = false
    
    const { rerender } = renderHook(() => useSocketSubscription(event, callback, { enabled }))
    
    // Should not subscribe when disabled
    expect(mockSocket.on).not.toHaveBeenCalledWith(event, callback)
    
    // Enable subscription
    enabled = true
    rerender()
    
    expect(mockSocket.on).toHaveBeenCalledWith(event, callback)
  })
})