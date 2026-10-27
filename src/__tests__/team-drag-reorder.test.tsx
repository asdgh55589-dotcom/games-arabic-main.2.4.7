/**
 * @jest-environment jsdom
 */
import { renderHook } from '@testing-library/react'
import { useDragReorder } from '@/hooks/use-drag-reorder'

describe('useDragReorder', () => {
  it('returns sensors and handleDragEnd', () => {
    const onReorder = jest.fn()
    const { result } = renderHook(() => useDragReorder([{ id: 'a' }, { id: 'b' }], onReorder))
    expect(result.current.sensors).toBeDefined()
    expect(typeof result.current.handleDragEnd).toBe('function')
    expect(result.current.DndContext).toBeDefined()
    expect(result.current.SortableContext).toBeDefined()
  })

  it('handleDragEnd with no over does nothing', () => {
    const onReorder = jest.fn()
    const { result } = renderHook(() => useDragReorder([{ id: 'a' }, { id: 'b' }], onReorder))
    result.current.handleDragEnd({ active: { id: 'a' }, over: null } as any)
    expect(onReorder).not.toHaveBeenCalled()
  })

  it('handleDragEnd same id does nothing', () => {
    const onReorder = jest.fn()
    const { result } = renderHook(() => useDragReorder([{ id: 'a' }, { id: 'b' }], onReorder))
    result.current.handleDragEnd({ active: { id: 'a' }, over: { id: 'a' } } as any)
    expect(onReorder).not.toHaveBeenCalled()
  })

  it('handleDragEnd reorders and calls onReorder', () => {
    const onReorder = jest.fn()
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    const { result } = renderHook(() => useDragReorder(items, onReorder))
    result.current.handleDragEnd({ active: { id: 'a' }, over: { id: 'c' } } as any)
    expect(onReorder).toHaveBeenCalledWith([{ id: 'b' }, { id: 'c' }, { id: 'a' }])
  })
})
