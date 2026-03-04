/// <reference types="vite/client" />

interface Window {
    go: any;
}

// Type stub for @tailwindcss/vite — needed for TS 4.6 (moduleResolution: Node)
declare module '@tailwindcss/vite' {
    import type { Plugin } from 'vite'
    export default function tailwindcss(): Plugin
}

