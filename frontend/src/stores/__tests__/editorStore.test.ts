import { describe, it, expect, beforeEach } from 'vitest'
import { useEditorStore } from '../editorStore'

const INITIAL_STATE = {
  groups: [{ id: 'group-1', tabs: [], activeTabId: null }],
  activeGroupId: 'group-1',
}

beforeEach(() => {
  localStorage.clear()
  useEditorStore.setState(INITIAL_STATE)
})

describe('addTab', () => {
  it('creates a tab with the default name', () => {
    const id = useEditorStore.getState().addTab()
    const { groups } = useEditorStore.getState()
    expect(groups[0].tabs).toHaveLength(1)
    expect(groups[0].tabs[0].name).toBe('New Query')
    expect(groups[0].activeTabId).toBe(id)
  })

  it('auto-increments name for duplicate base names', () => {
    useEditorStore.getState().addTab()
    useEditorStore.getState().addTab()
    const names = useEditorStore.getState().groups[0].tabs.map(t => t.name)
    expect(names).toContain('New Query')
    expect(names).toContain('New Query 2')
  })

  it('accepts a custom name', () => {
    useEditorStore.getState().addTab({ name: 'Audit Query' })
    expect(useEditorStore.getState().groups[0].tabs[0].name).toBe('Audit Query')
  })

  it('deduplicates table tabs with the same content', () => {
    const id1 = useEditorStore.getState().addTab({ type: 'table', content: 'users' })
    const id2 = useEditorStore.getState().addTab({ type: 'table', content: 'users' })
    expect(id1).toBe(id2)
    expect(useEditorStore.getState().groups[0].tabs).toHaveLength(1)
  })

  it('does not deduplicate table tabs with different content', () => {
    useEditorStore.getState().addTab({ type: 'table', content: 'users' })
    useEditorStore.getState().addTab({ type: 'table', content: 'orders' })
    expect(useEditorStore.getState().groups[0].tabs).toHaveLength(2)
  })

  it('deduplicates the settings tab', () => {
    const id1 = useEditorStore.getState().addTab({ type: 'settings' })
    const id2 = useEditorStore.getState().addTab({ type: 'settings' })
    expect(id1).toBe(id2)
    expect(useEditorStore.getState().groups[0].tabs).toHaveLength(1)
  })

  it('deduplicates the shortcuts tab', () => {
    const id1 = useEditorStore.getState().addTab({ type: 'shortcuts' })
    const id2 = useEditorStore.getState().addTab({ type: 'shortcuts' })
    expect(id1).toBe(id2)
    expect(useEditorStore.getState().groups[0].tabs).toHaveLength(1)
  })

  it('sets isRunning to false by default', () => {
    const id = useEditorStore.getState().addTab()
    const tab = useEditorStore.getState().groups[0].tabs.find(t => t.id === id)
    expect(tab?.isRunning).toBe(false)
  })
})

describe('removeTab', () => {
  it('removes the specified tab', () => {
    const id = useEditorStore.getState().addTab()
    useEditorStore.getState().removeTab(id)
    expect(useEditorStore.getState().groups[0].tabs).toHaveLength(0)
  })

  it('falls back activeTabId to the last remaining tab', () => {
    const id1 = useEditorStore.getState().addTab()
    const id2 = useEditorStore.getState().addTab()
    useEditorStore.getState().setActiveTabId(id1, 'group-1')
    useEditorStore.getState().removeTab(id1)
    expect(useEditorStore.getState().groups[0].activeTabId).toBe(id2)
  })

  it('sets activeTabId to null when all tabs are removed', () => {
    const id = useEditorStore.getState().addTab()
    useEditorStore.getState().removeTab(id)
    expect(useEditorStore.getState().groups[0].activeTabId).toBeNull()
  })
})

describe('renameTab', () => {
  it('renames a tab', () => {
    const id = useEditorStore.getState().addTab()
    useEditorStore.getState().renameTab(id, 'My Report')
    const tab = useEditorStore.getState().groups[0].tabs.find(t => t.id === id)
    expect(tab?.name).toBe('My Report')
  })

  it('does not affect other tabs', () => {
    useEditorStore.getState().addTab()
    const id2 = useEditorStore.getState().addTab()
    useEditorStore.getState().renameTab(id2, 'Renamed')
    const names = useEditorStore.getState().groups[0].tabs.map(t => t.name)
    expect(names).toContain('New Query')
    expect(names).toContain('Renamed')
  })
})

describe('setTabRunning', () => {
  it('marks a tab as running', () => {
    const id = useEditorStore.getState().addTab()
    useEditorStore.getState().setTabRunning(id, true)
    const tab = useEditorStore.getState().groups[0].tabs.find(t => t.id === id)
    expect(tab?.isRunning).toBe(true)
  })

  it('clears the running flag', () => {
    const id = useEditorStore.getState().addTab()
    useEditorStore.getState().setTabRunning(id, true)
    useEditorStore.getState().setTabRunning(id, false)
    const tab = useEditorStore.getState().groups[0].tabs.find(t => t.id === id)
    expect(tab?.isRunning).toBe(false)
  })

  it('does not affect other tabs', () => {
    const id1 = useEditorStore.getState().addTab()
    const id2 = useEditorStore.getState().addTab()
    useEditorStore.getState().setTabRunning(id1, true)
    const tab2 = useEditorStore.getState().groups[0].tabs.find(t => t.id === id2)
    expect(tab2?.isRunning).toBe(false)
  })
})

describe('updateTabQuery', () => {
  it('updates query content for a tab', () => {
    const id = useEditorStore.getState().addTab()
    useEditorStore.getState().updateTabQuery(id, 'SELECT 1')
    const tab = useEditorStore.getState().groups[0].tabs.find(t => t.id === id)
    expect(tab?.query).toBe('SELECT 1')
  })
})
