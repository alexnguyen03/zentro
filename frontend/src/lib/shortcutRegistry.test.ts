import { describe, expect, it } from 'vitest';
import {
  type CommandId,
  getCommandById,
  getCommandRegistry,
  getDefaultShortcutMap,
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
});
