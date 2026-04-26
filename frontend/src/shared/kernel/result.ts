export interface KernelError {
    code: string;
    message: string;
    retryable?: boolean;
    context?: Record<string, unknown>;
}

export type KernelResult<T> =
    | { ok: true; data: T }
    | { ok: false; error: KernelError };

export function ok<T>(data: T): KernelResult<T> {
    return { ok: true, data };
}

export function fail<T = never>(error: KernelError): KernelResult<T> {
    return { ok: false, error };
}

