type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function formatPayload(payload?: unknown): unknown {
    if (!payload) return undefined;
    if (payload instanceof Error) {
        return {
            name: payload.name,
            message: payload.message,
            stack: payload.stack,
        };
    }
    return payload;
}

function write(level: LogLevel, message: string, payload?: unknown) {
    const entry = {
        scope: 'zentro',
        level,
        message,
        ts: new Date().toISOString(),
        payload: formatPayload(payload),
    };

    if (level === 'error') {
        console.error('[zentro]', entry);
    } else if (level === 'warn') {
        console.warn('[zentro]', entry);
    } else {
        console.log('[zentro]', entry);
    }
}

export const appLogger = {
    debug(message: string, payload?: unknown) {
        write('debug', message, payload);
    },
    info(message: string, payload?: unknown) {
        write('info', message, payload);
    },
    warn(message: string, payload?: unknown) {
        write('warn', message, payload);
    },
    error(message: string, payload?: unknown) {
        write('error', message, payload);
    },
};

