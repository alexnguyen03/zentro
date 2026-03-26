/// <reference types="vite/client" />

type WailsWindowApi = Record<string, (...args: unknown[]) => unknown>;

interface Window {
    go?: {
        app?: {
            App?: WailsWindowApi;
        };
    };
}

// Type stub for @tailwindcss/vite — needed for TS 4.6 (moduleResolution: Node)
declare module '@tailwindcss/vite' {
    import type { Plugin } from 'vite'
    export default function tailwindcss(): Plugin
}
