import React, { useState, useRef, useEffect } from 'react';
import { Plus, Play, Square, Save, Settings, ChevronDown, Search, RefreshCw, Lock } from 'lucide-react';
import { useConnectionStore } from '../../stores/connectionStore';
import { useEditorStore } from '../../stores/editorStore';
import { useResultStore } from '../../stores/resultStore';
import { ExecuteQuery, CancelQuery, Connect, SwitchDatabase } from '../../../wailsjs/go/app/App';

export const Toolbar: React.FC = () => {
    const { isConnected, activeProfile, connections, databases } = useConnectionStore();
    const { tabs, activeTabId, addTab } = useEditorStore();
    const { results } = useResultStore();

    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isDbDropdownOpen, setIsDbDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const dbDropdownRef = useRef<HTMLDivElement>(null);

    const activeTab = tabs.find(t => t.id === activeTabId);
    const isRunning = activeTab?.isRunning ?? false;
    const isDone = activeTabId ? (results[activeTabId]?.isDone ?? true) : true;

    // Handle outside click for dropdowns
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
            if (dbDropdownRef.current && !dbDropdownRef.current.contains(event.target as Node)) {
                setIsDbDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

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

    const handleSwitchDb = async (dbName: string) => {
        setIsDbDropdownOpen(false);
        if (activeProfile?.db_name === dbName) return;
        try {
            await SwitchDatabase(dbName);
        } catch (err) {
            console.error('Failed to switch database:', err);
        }
    };

    // Build the breadcrumb string
    let connBreadcrumbText = 'No Connection';
    if (isConnected && activeProfile) {
        // e.g., PostgreSQL : require : ep-dawn
        const driverName = activeProfile.driver === 'postgres' ? 'PostgreSQL' : 'SQL Server';
        const ssl = activeProfile.ssl_mode || 'disable';
        const hostShort = activeProfile.host.split('.')[0]; // Only first part of host
        connBreadcrumbText = `${driverName} : ${ssl} : ${hostShort}`;
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
                {!isConnected ? (
                    <div className="connection-breadcrumb-wrapper">
                        <div className="connection-breadcrumb">No Connection</div>
                    </div>
                ) : (
                    <div className="breadcrumb-group" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <div className="connection-breadcrumb-wrapper" ref={dropdownRef}>
                            <div
                                className={`connection-breadcrumb ${isDropdownOpen ? 'active' : ''}`}
                                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            >
                                {connBreadcrumbText}
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

                        <div className="breadcrumb-divider" style={{ opacity: 0.5, fontSize: 14 }}>:</div>

                        <div className="connection-breadcrumb-wrapper" ref={dbDropdownRef}>
                            <div
                                className={`connection-breadcrumb ${isDbDropdownOpen ? 'active' : ''}`}
                                onClick={() => setIsDbDropdownOpen(!isDbDropdownOpen)}
                                title="Switch active database"
                            >
                                {activeProfile?.db_name}
                                <ChevronDown size={14} className="breadcrumb-chevron" />
                            </div>

                            {isDbDropdownOpen && (
                                <div className="connection-dropdown" style={{ width: 220, left: 0, transform: 'none' }}>
                                    <div className="dropdown-header">Databases</div>
                                    {databases.length === 0 ? (
                                        <div className="dropdown-empty">No databases found</div>
                                    ) : (
                                        <div className="dropdown-list">
                                            {databases.map((dbName) => (
                                                <div
                                                    key={dbName}
                                                    className={`dropdown-item ${activeProfile?.db_name === dbName ? 'active' : ''}`}
                                                    onClick={() => handleSwitchDb(dbName)}
                                                >
                                                    <div className="dropdown-item-name">{dbName}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
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
