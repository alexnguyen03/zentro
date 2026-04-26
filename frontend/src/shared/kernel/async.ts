import { fail, ok, type KernelResult } from './result';

export async function runSafe<T>(
    code: string,
    message: string,
    runner: () => Promise<T>,
    context?: Record<string, unknown>,
): Promise<KernelResult<T>> {
    try {
        return ok(await runner());
    } catch (error) {
        return fail({
            code,
            message,
            context: {
                ...context,
                cause: error instanceof Error ? error.message : String(error),
            },
        });
    }
}

