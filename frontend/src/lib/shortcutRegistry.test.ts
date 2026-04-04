import { describe, expect, it } from 'vitest';
import {
  type CommandId,
  eventToKeyToken,
  getCommandById,
  getCommandRegistry,
  getDefaultShortcutMap,
  normalizeBinding,
  registerCommandContribution,
} from './shortcutRegistry';

describe('shortcutRegistry contributions', () => {
  it('registers and unregisters command contributions', () => {
    const commandId: CommandId = 'ext.test.command';
    const contribution = {
      id: commandId,
      label: 'Test Contribution',
      category: 'App' as const,
      defaultBinding: 'Ctrl+Alt+Y',
      action: () => undefined,
    };

    const unregister = registerCommandContribution(contribution);
    expect(getCommandById(commandId)?.label).toBe('Test Contribution');
    expect(getCommandRegistry().some((item) => item.id === commandId)).toBe(true);
    expect(getDefaultShortcutMap()[commandId]).toBe('Ctrl+Alt+Y');

    unregister();
    expect(getCommandById(commandId)).toBeUndefined();
  });

  it('normalizes modifier ordering before primary key while preserving chord sequence', () => {
    expect(normalizeBinding('alt+ctrl+e')).toBe('ctrl+alt+e');
    expect(normalizeBinding('shift+e+ctrl')).toBe('ctrl+shift+e');
    expect(normalizeBinding('ctrl+k ctrl+b')).toBe('ctrl+k ctrl+b');
  });

  it('emits key token with modifier-first ordering', () => {
    const event = new KeyboardEvent('keydown', {
      key: 'E',
      ctrlKey: true,
      shiftKey: true,
      altKey: true,
    });
    expect(eventToKeyToken(event)).toBe('ctrl+shift+alt+e');
  });
});
