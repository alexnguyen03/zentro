import React from 'react';
import { appLogger } from '../../lib/logger';

interface ErrorBoundaryState {
    hasError: boolean;
    message: string;
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
    state: ErrorBoundaryState = {
        hasError: false,
        message: '',
    };

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return {
            hasError: true,
            message: error.message,
        };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo): void {
        appLogger.error('react render error', {
            message: error.message,
            stack: error.stack,
            componentStack: info.componentStack,
        });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="h-screen w-screen flex items-center justify-center bg-background text-foreground">
                    <div className="max-w-md rounded-sm border border-border bg-card p-6">
                        <h1 className="text-lg font-semibold mb-2">Unexpected application error</h1>
                        <p className="text-sm text-muted-foreground mb-4">
                            A runtime error occurred. Details were logged to the console.
                        </p>
                        <p className="text-xs text-error break-all">{this.state.message}</p>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

