import { useMemo } from 'react';

export function useEditorTheme(theme: string) {
    return useMemo(() => {
        if (theme === 'dark') return 'vs-dark';
        if (theme === 'light') return 'vs';
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'vs-dark' : 'vs';
    }, [theme]);
}
