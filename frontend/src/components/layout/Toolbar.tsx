import React, { useState, useRef, useEffect } from 'react';
import { Plus, Play, Square, Save, Settings, ChevronDown, Search, RefreshCw, Lock } from 'lucide-react';
import { useConnectionStore } from '../../stores/connectionStore';
import { useEditorStore } from '../../stores/editorStore';
import { useResultStore } from '../../stores/resultStore';
import { ExecuteQuery, CancelQuery, Connect } from '../../../wailsjs/go/app/App';

export const Toolbar: React.FC = () => {
    const { isConnected, activeProfile, connections } = useConnectionStore();
    const { tabs, activeTabId, addTab } = useEditorStore();
    const { results } = useResultStore();

    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const activeTab = tabs.find(t => t.id === activeTabId);
    const isRunning = activeTab?.isRunning ?? false;
    const isDone = activeTabId ? (results[activeTabId]?.isDone ?? true) : true;

    // Handle outside click for dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        if (isDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isDropdownOpen]);

    const handleRun = async () => {
        if (!activeTab || !isConnected) return;
        try { await ExecuteQuery(activeTab.id, activeTab.query); } catch { /* event-driven, ignore */ }
    };

    const handleCancel = async () => {
        if (!activeTabId) return;
        try { await CancelQuery(activeTabId); } catch { /* swallow */ }
    };

    const handleConnect = async (profileName: string) => {
        setIsDropdownOpen(false);
        if (activeProfile?.name === profileName) return; // Already connected
        try {
            await Connect(profileName);
        } catch (err) {
            console.error('Failed to switch connection:', err);
        }
    };

    // Build the breadcrumb string
    let breadcrumbText = 'No Connection';
    if (isConnected && activeProfile) {
        // e.g., PostgreSQL : require : ep-dawn : neondb
        const driverName = activeProfile.driver === 'postgres' ? 'PostgreSQL' : 'SQL Server';
        const ssl = activeProfile.ssl_mode || 'disable';
        const hostShort = activeProfile.host.split('.')[0]; // Only first part of host
        breadcrumbText = `${driverName} : ${ssl} : ${hostShort} : ${activeProfile.db_name}`;
    }

    return (
        <div className="toolbar tableplus-toolbar">
            <div className="toolbar-left">
                <button className="toolbar-btn icon-only" title="Toggle Safe Mode">
                    <Lock size={14} />
                </button>
                <button className="toolbar-btn icon-only" title="Refresh">
                    <RefreshCw size={14} />
                </button>

                <div className="toolbar-separator" />

                <button className="toolbar-btn icon-only" title="New Tab (Ctrl+T)" onClick={() => addTab()}>
                    <Plus size={16} />
                </button>
                <button
                    className="toolbar-btn icon-only"
                    disabled={!isConnected || !activeTab || isRunning}
                    title="Run Query (Ctrl+Enter)"
                    onClick={handleRun}
                >
                    <Play size={16} color={!isConnected || isRunning ? 'currentColor' : 'var(--success-color)'} fill={!isConnected || isRunning ? 'none' : 'currentColor'} />
                </button>
                <button
                    className="toolbar-btn icon-only"
                    disabled={!isRunning}
                    title="Cancel Execution"
                    onClick={handleCancel}
                >
                    <Square size={16} fill={isRunning ? 'currentColor' : 'none'} color={isRunning ? 'var(--error-color)' : 'currentColor'} />
                </button>
            </div>

            <div className="toolbar-center">
                <div className="connection-breadcrumb-wrapper" ref={dropdownRef}>
                    <div
                        className={`connection-breadcrumb ${isDropdownOpen ? 'active' : ''}`}
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    >
                        {breadcrumbText}
                        <ChevronDown size={14} className="breadcrumb-chevron" />
                    </div>

                    {isDropdownOpen && (
                        <div className="connection-dropdown">
                            <div className="dropdown-header">Connections</div>
                            {connections.length === 0 ? (
                                <div className="dropdown-empty">No connections found</div>
                            ) : (
                                <div className="dropdown-list">
                                    {connections.map((conn) => (
                                        <div
                                            key={conn.name}
                                            className={`dropdown-item ${activeProfile?.name === conn.name ? 'active' : ''}`}
                                            onClick={() => handleConnect(conn.name)}
                                        >
                                            <div className="dropdown-item-name">{conn.name}</div>
                                            <div className="dropdown-item-host">{conn.host}:{conn.port}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="toolbar-right">
                {/* <span className="network-indicator">24 b/s <span className="network-badge">loc</span></span> */}

                <div className="toolbar-separator" />

                <button className="toolbar-btn icon-only" title="Search">
                    <Search size={14} />
                </button>

                <button className="toolbar-btn icon-only" disabled={!isDone || !activeTab} title="Export CSV">
                    <Save size={14} />
                </button>
                <button className="toolbar-btn icon-only" title="Settings">
                    <Settings size={14} />
                </button>
            </div>
        </div>
    );
};
