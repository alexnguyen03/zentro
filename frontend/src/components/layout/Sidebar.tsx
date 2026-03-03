import React, { useState, useRef, useEffect, MouseEvent } from 'react';
import { useConnectionStore } from '../../stores/connectionStore';

export const Sidebar: React.FC = () => {
    const isConnected = useConnectionStore(state => state.isConnected);

    return (
        <div className="sidebar" style={{ width: '100%' }}>
            <div className="sidebar-header">
                Database Explorer
            </div>
            <div className="sidebar-content">
                {!isConnected ? (
                    <div className="empty-state">
                        <span style={{ fontSize: 48, opacity: 0.2 }}>🔌</span>
                        <div>No Active Connection</div>
                    </div>
                ) : (
                    <div style={{ padding: '12px', color: 'var(--text-secondary)' }}>
                        <p>Connection active.</p>
                        <p>TODO: Render Database Tree</p>
                    </div>
                )}
            </div>
        </div>
    );
};
