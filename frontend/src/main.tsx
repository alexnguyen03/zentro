import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { ToastProvider } from './components/layout/Toast'
import { useSettingsStore } from './stores/settingsStore'

const container = document.getElementById('root')
const root = createRoot(container!)

const Root = () => {
    const toastPlacement = useSettingsStore(s => s.toastPlacement);

    return (
        <React.StrictMode>
            <ToastProvider placement={toastPlacement}>
                <App />
            </ToastProvider>
        </React.StrictMode>
    );
};

root.render(<Root />)
