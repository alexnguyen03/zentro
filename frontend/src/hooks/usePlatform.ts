import { useEffect, useState } from 'react';
import * as runtime from '../../wailsjs/runtime/runtime';

type Platform = 'darwin' | 'windows' | 'linux' | null;

let cached: Platform = null;

export function usePlatform(): Platform {
    const [platform, setPlatform] = useState<Platform>(cached);

    useEffect(() => {
        if (cached) return;
        const environmentFn = (runtime as { Environment?: () => Promise<{ platform?: string }> }).Environment;
        if (typeof environmentFn !== 'function') return;
        void environmentFn().then((env) => {
            cached = env.platform as Platform;
            setPlatform(cached);
        }).catch(() => {
            // non-runtime env (dev browser)
        });
    }, []);

    return platform;
}
