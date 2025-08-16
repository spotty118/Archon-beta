import { renderHook, act } from '@testing-library/react'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { useOptimisticUpdates } from '@/hooks/useOptimisticUpdates'

describe('useOptimisticUpdates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('initializes with provided data', () => {
    const initialData = [
      { id: '1', name: 'Item 1' },
      { id: '2', name: 'Item 2' }
    ]
    
    const { result } = renderHook(() => useOptimisticUpdates(initialData))
    
    expect(result.current.data).toEqual(initialData)
    expect(result.current.pendingUpdates).toEqual([])
    expect(result.current.isOptimistic).toBe(false)
  })

  test('applies optimistic update immediately', () => {
    const initialData = [
      { id: '1', name: 'Item 1' },
      { id: '2', name: 'Item 2' }
    ]
    
    const { result } = renderHook(() => useOptimisticUpdates(initialData))
    
    act(() => {
      result.current.optimisticUpdate('1', { name: 'Updated Item 1' })
    })
    
    expect(result.current.data).toEqual([
      { id: '1', name: 'Updated Item 1' },
      { id: '2', name: 'Item 2' }
    ])
    expect(result.current.isOptimistic).toBe(true)
    expect(result.current.pendingUpdates).toHaveLength(1)
  })

  test('adds optimistic item', () => {
    const initialData = [
      { id: '1', name: 'Item 1' }
    ]
    
    const { result } = renderHook(() => useOptimisticUpdates(initialData))
    
    const newItem = { id: 'temp-2', name: 'New Item' }
    
    act(() => {
      result.current.optimisticAdd(newItem)
    })
    
    expect(result.current.data).toEqual([
      { id: '1', name: 'Item 1' },
      { id: 'temp-2', name: 'New Item' }
    ])
    expect(result.current.isOptimistic).toBe(true)
  })

  test('removes optimistic item', () => {
    const initialData = [
      { id: '1', name: 'Item 1' },
      { id: '2', name: 'Item 2' }
    ]
    
    const { result } = renderHook(() => useOptimisticUpdates(initialData))
    
    act(() => {
      result.current.optimisticRemove('1')
    })
    
    expect(result.current.data).toEqual([
      { id: '2', name: 'Item 2' }
    ])
    expect(result.current.isOptimistic).toBe(true)
  })

  test('confirms pending update with server response', () => {
    const initialData = [
      { id: '1', name: 'Item 1' }
    ]
    
    const { result } = renderHook(() => useOptimisticUpdates(initialData))
    
    // Apply optimistic update
    act(() => {
      result.current.optimisticUpdate('1', { name: 'Updated Item 1' })
    })
    
    expect(result.current.pendingUpdates).toHaveLength(1)
    
    // Confirm with server response
    act(() => {
      result.current.confirmUpdate('1', { id: '1', name: 'Server Updated Item 1' })
    })
    
    expect(result.current.data).toEqual([
      { id: '1', name: 'Server Updated Item 1' }
    ])
    expect(result.current.pendingUpdates).toHaveLength(0)
    expect(result.current.isOptimistic).toBe(false)
  })

  test('reverts failed update', () => {
    const initialData = [
      { id: '1', name: 'Item 1' }
    ]
    
    const { result } = renderHook(() => useOptimisticUpdates(initialData))
    
    // Apply optimistic update
    act(() => {
      result.current.optimisticUpdate('1', { name: 'Updated Item 1' })
    })
    
    expect(result.current.data[0].name).toBe('Updated Item 1')
    
    // Revert failed update
    act(() => {
      result.current.revertUpdate('1')
    })
    
    expect(result.current.data).toEqual(initialData)
    expect(result.current.pendingUpdates).toHaveLength(0)
    expect(result.current.isOptimistic).toBe(false)
  })

  test('handles multiple pending updates', () => {
    const initialData = [
      { id: '1', name: 'Item 1' },
      { id: '2', name: 'Item 2' }
    ]
    
    const { result } = renderHook(() => useOptimisticUpdates(initialData))
    
    // Apply multiple optimistic updates
    act(() => {
      result.current.optimisticUpdate('1', { name: 'Updated Item 1' })
      result.current.optimisticUpdate('2', { name: 'Updated Item 2' })
    })
    
    expect(result.current.pendingUpdates).toHaveLength(2)
    expect(result.current.data).toEqual([
      { id: '1', name: 'Updated Item 1' },
      { id: '2', name: 'Updated Item 2' }
    ])
    
    // Confirm one update
    act(() => {
      result.current.confirmUpdate('1', { id: '1', name: 'Server Updated Item 1' })
    })
    
    expect(result.current.pendingUpdates).toHaveLength(1)
    expect(result.current.isOptimistic).toBe(true) // Still has pending updates
  })

  test('provides retry functionality for failed updates', () => {
    const initialData = [
      { id: '1', name: 'Item 1' }
    ]
    
    const mockRetryFn = vi.fn()
    
    const { result } = renderHook(() => useOptimisticUpdates(initialData))
    
    // Apply optimistic update with retry function
    act(() => {
      result.current.optimisticUpdate('1', { name: 'Updated Item 1' }, mockRetryFn)
    })
    
    // Mark as failed
    act(() => {
      result.current.markAsFailed('1', 'Network error')
    })
    
    const failedUpdate = result.current.pendingUpdates.find(u => u.id === '1')
    expect(failedUpdate?.status).toBe('failed')
    expect(failedUpdate?.error).toBe('Network error')
    
    // Retry failed update
    act(() => {
      result.current.retryUpdate('1')
    })
    
    expect(mockRetryFn).toHaveBeenCalled()
  })

  test('handles concurrent updates to same item', () => {
    const initialData = [
      { id: '1', name: 'Item 1', value: 10 }
    ]
    
    const { result } = renderHook(() => useOptimisticUpdates(initialData))
    
    // Apply multiple updates to same item
    act(() => {
      result.current.optimisticUpdate('1', { name: 'Updated Name' })
      result.current.optimisticUpdate('1', { value: 20 })
    })
    
    // Should merge updates
    expect(result.current.data[0]).toEqual({
      id: '1',
      name: 'Updated Name',
      value: 20
    })
    
    // Should only have one pending update (merged)
    expect(result.current.pendingUpdates).toHaveLength(1)
  })

  test('provides rollback functionality', () => {
    const initialData = [
      { id: '1', name: 'Item 1' },
      { id: '2', name: 'Item 2' }
    ]
    
    const { result } = renderHook(() => useOptimisticUpdates(initialData))
    
    // Apply multiple optimistic changes
    act(() => {
      result.current.optimisticUpdate('1', { name: 'Updated Item 1' })
      result.current.optimisticAdd({ id: 'temp-3', name: 'New Item' })
      result.current.optimisticRemove('2')
    })
    
    expect(result.current.data).toHaveLength(2) // Original item 1 (updated) + new item
    expect(result.current.pendingUpdates).toHaveLength(3)
    
    // Rollback all changes
    act(() => {
      result.current.rollbackAll()
    })
    
    expect(result.current.data).toEqual(initialData)
    expect(result.current.pendingUpdates).toHaveLength(0)
    expect(result.current.isOptimistic).toBe(false)
  })

  test('handles update timeouts', async () => {
    vi.useFakeTimers()
    
    const initialData = [
      { id: '1', name: 'Item 1' }
    ]
    
    const { result } = renderHook(() => 
      useOptimisticUpdates(initialData, { timeout: 5000 })
    )
    
    // Apply optimistic update
    act(() => {
      result.current.optimisticUpdate('1', { name: 'Updated Item 1' })
    })
    
    expect(result.current.pendingUpdates).toHaveLength(1)
    
    // Fast-forward time to trigger timeout
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    
    // Should revert timed-out update
    expect(result.current.data).toEqual(initialData)
    expect(result.current.pendingUpdates).toHaveLength(0)
    
    vi.useRealTimers()
  })

  test('preserves update order', () => {
    const initialData = [
      { id: '1', name: 'Item 1', version: 1 }
    ]
    
    const { result } = renderHook(() => useOptimisticUpdates(initialData))
    
    // Apply updates in sequence
    act(() => {
      result.current.optimisticUpdate('1', { version: 2 })
      result.current.optimisticUpdate('1', { version: 3 })
      result.current.optimisticUpdate('1', { version: 4 })
    })
    
    // Latest update should be applied
    expect(result.current.data[0].version).toBe(4)
    
    // Confirm updates in different order
    act(() => {
      // Confirm middle update first
      result.current.confirmUpdate('1', { id: '1', name: 'Item 1', version: 3 })
    })
    
    // Should still maintain correct state
    expect(result.current.data[0].version).toBe(4) // Latest optimistic update
  })

  test('provides update status information', () => {
    const initialData = [
      { id: '1', name: 'Item 1' }
    ]
    
    const { result } = renderHook(() => useOptimisticUpdates(initialData))
    
    // Apply optimistic update
    act(() => {
      result.current.optimisticUpdate('1', { name: 'Updated Item 1' })
    })
    
    const updateStatus = result.current.getUpdateStatus('1')
    expect(updateStatus).toEqual({
      isPending: true,
      isFailed: false,
      error: null,
      retryCount: 0
    })
    
    // Mark as failed
    act(() => {
      result.current.markAsFailed('1', 'Network error')
    })
    
    const failedStatus = result.current.getUpdateStatus('1')
    expect(failedStatus).toEqual({
      isPending: true,
      isFailed: true,
      error: 'Network error',
      retryCount: 0
    })
  })

  test('handles complex nested object updates', () => {
    const initialData = [
      { 
        id: '1', 
        name: 'Item 1',
        metadata: { tags: ['tag1'], count: 5 },
        config: { enabled: true }
      }
    ]
    
    const { result } = renderHook(() => useOptimisticUpdates(initialData))
    
    // Apply deep update
    act(() => {
      result.current.optimisticUpdate('1', { 
        metadata: { ...initialData[0].metadata, count: 10 }
      })
    })
    
    expect(result.current.data[0]).toEqual({
      id: '1',
      name: 'Item 1',
      metadata: { tags: ['tag1'], count: 10 },
      config: { enabled: true }
    })
  })
})