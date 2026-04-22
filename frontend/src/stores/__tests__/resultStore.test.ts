import { describe, it, expect, beforeEach } from 'vitest'
import { useResultStore } from '../resultStore'

beforeEach(() => {
  useResultStore.setState({ results: {} })
})

describe('initTab', () => {
  it('creates an empty result entry', () => {
    useResultStore.getState().initTab('tab-1')
    const r = useResultStore.getState().results['tab-1']
    expect(r).toBeDefined()
    expect(r.isDone).toBe(false)
    expect(r.rows).toEqual([])
    expect(r.columns).toEqual([])
    expect(r.error).toBeUndefined()
    expect(r.filterExpr).toBe('')
  })

  it('preserves columns/rows from a previous result on re-init', () => {
    useResultStore.getState().initTab('tab-1')
    useResultStore.getState().appendRows('tab-1', ['id'], [['1']])
    useResultStore.getState().initTab('tab-1')
    const r = useResultStore.getState().results['tab-1']
    expect(r.columns).toEqual(['id'])
    expect(r.rows).toEqual([['1']])
    expect(r.isDone).toBe(false)
  })
})

describe('appendRows', () => {
  it('sets columns and rows on the first chunk', () => {
    useResultStore.getState().initTab('tab-1')
    useResultStore.getState().appendRows('tab-1', ['id', 'name'], [['1', 'Alice']])
    const r = useResultStore.getState().results['tab-1']
    expect(r.columns).toEqual(['id', 'name'])
    expect(r.rows).toEqual([['1', 'Alice']])
  })

  it('replaces rows when a chunk carries columns (first chunk)', () => {
    useResultStore.getState().initTab('tab-1')
    useResultStore.getState().appendRows('tab-1', ['id'], [['1'], ['2']])
    useResultStore.getState().appendRows('tab-1', ['id'], [['3']])
    const r = useResultStore.getState().results['tab-1']
    expect(r.rows).toEqual([['3']])
  })

  it('accumulates rows across chunks without columns', () => {
    useResultStore.getState().initTab('tab-1')
    useResultStore.getState().appendRows('tab-1', ['id'], [['1']])
    useResultStore.getState().appendRows('tab-1', undefined, [['2'], ['3']])
    const r = useResultStore.getState().results['tab-1']
    expect(r.rows).toHaveLength(3)
    expect(r.rows[2]).toEqual(['3'])
  })

  it('stores tableName and primaryKeys from the first chunk', () => {
    useResultStore.getState().initTab('tab-1')
    useResultStore.getState().appendRows('tab-1', ['id'], [['1']], 'users', ['id'])
    const r = useResultStore.getState().results['tab-1']
    expect(r.tableName).toBe('users')
    expect(r.primaryKeys).toEqual(['id'])
  })

  it('is a no-op for an uninitialised tab', () => {
    useResultStore.getState().appendRows('ghost', ['id'], [['1']])
    expect(useResultStore.getState().results['ghost']).toBeUndefined()
  })
})

describe('setDone', () => {
  it('marks the tab as done', () => {
    useResultStore.getState().initTab('tab-1')
    useResultStore.getState().setDone('tab-1', 0, 50, true, false)
    expect(useResultStore.getState().results['tab-1'].isDone).toBe(true)
  })

  it('stores the error message', () => {
    useResultStore.getState().initTab('tab-1')
    useResultStore.getState().setDone('tab-1', 0, 0, true, false, 'syntax error')
    expect(useResultStore.getState().results['tab-1'].error).toBe('syntax error')
  })

  it('sets affected rows for a non-select query', () => {
    useResultStore.getState().initTab('tab-1')
    useResultStore.getState().setDone('tab-1', 42, 100, false, false)
    const r = useResultStore.getState().results['tab-1']
    expect(r.affected).toBe(42)
    expect(r.isSelect).toBe(false)
  })

  it('reflects row count (from rows) for a select query', () => {
    useResultStore.getState().initTab('tab-1')
    useResultStore.getState().appendRows('tab-1', ['x'], [['a'], ['b'], ['c']])
    useResultStore.getState().setDone('tab-1', 0, 100, true, false)
    expect(useResultStore.getState().results['tab-1'].affected).toBe(3)
  })

  it('marks isFetchingMore as false', () => {
    useResultStore.getState().initTab('tab-1')
    useResultStore.getState().setOffset('tab-1', 100)
    useResultStore.getState().setDone('tab-1', 0, 0, true, false)
    expect(useResultStore.getState().results['tab-1'].isFetchingMore).toBe(false)
  })
})

describe('clearResult', () => {
  it('removes the result for a tab', () => {
    useResultStore.getState().initTab('tab-1')
    useResultStore.getState().clearResult('tab-1')
    expect(useResultStore.getState().results['tab-1']).toBeUndefined()
  })

  it('does not affect other tabs', () => {
    useResultStore.getState().initTab('tab-1')
    useResultStore.getState().initTab('tab-2')
    useResultStore.getState().clearResult('tab-1')
    expect(useResultStore.getState().results['tab-2']).toBeDefined()
  })
})

describe('isDone', () => {
  it('returns false for an active tab', () => {
    useResultStore.getState().initTab('tab-1')
    expect(useResultStore.getState().isDone('tab-1')).toBe(false)
  })

  it('returns true after setDone', () => {
    useResultStore.getState().initTab('tab-1')
    useResultStore.getState().setDone('tab-1', 0, 0, true, false)
    expect(useResultStore.getState().isDone('tab-1')).toBe(true)
  })

  it('returns true for an unknown tab', () => {
    expect(useResultStore.getState().isDone('no-such-tab')).toBe(true)
  })
})

describe('setFilterExpr', () => {
  it('stores the filter expression', () => {
    useResultStore.getState().initTab('tab-1')
    useResultStore.getState().setFilterExpr('tab-1', 'id > 10')
    expect(useResultStore.getState().results['tab-1'].filterExpr).toBe('id > 10')
  })
})
