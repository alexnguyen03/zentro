import { ForceQuit } from '../../services/projectService';
import { saveAllOpenQueryTabs } from '../editor/scriptAutosave';

export async function forceQuitWithAutosave(): Promise<void> {
    try {
        await saveAllOpenQueryTabs({ timeoutMs: 8000, concurrency: 4 });
    } catch {
        // best effort
    }
    await ForceQuit();
}
