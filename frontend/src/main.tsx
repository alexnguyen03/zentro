import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { ToastProvider } from './components/layout/Toast'
import { useSettingsStore } from './stores/settingsStore'
import { ErrorBoundary } from './components/layout/ErrorBoundary'

const container = document.getElementById('root')
const root = createRoot(container!)

const Root = () => {
    const toastPlacement = useSettingsStore(s => s.toastPlacement);

    return (
        <React.StrictMode>
            <ErrorBoundary>
                <ToastProvider placement={toastPlacement}>
                    <App />
                </ToastProvider>
            </ErrorBoundary>
        </React.StrictMode>
    );
};

root.render(<Root />)
