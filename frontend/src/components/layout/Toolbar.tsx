import React, { useState, useRef, useEffect } from 'react';
import { Plus, Play, Square, Save, Settings, ChevronDown, ChevronRight, Search, RefreshCw, Lock } from 'lucide-react';
import { useConnectionStore } from '../../stores/connectionStore';
import { useEditorStore } from '../../stores/editorStore';
import { useResultStore } from '../../stores/resultStore';
import { ExecuteQuery, CancelQuery, Connect, SwitchDatabase } from '../../../wailsjs/go/app/App';

export const Toolbar: React.FC = () => {
    const { isConnected, activeProfile, connections, databases } = useConnectionStore();
    const { tabs, activeTabId, addTab } = useEditorStore();
    const { results } = useResultStore();

    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [hoveredConn, setHoveredConn] = useState<string | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const activeTab = tabs.find(t => t.id === activeTabId);
    const isRunning = activeTab?.isRunning ?? false;
    const isDone = activeTabId ? (results[activeTabId]?.isDone ?? true) : true;

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
                setHoveredConn(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleRun = async () => {
        if (!activeTab || !isConnected) return;
        try { await ExecuteQuery(activeTab.id, activeTab.query); } catch { /* event-driven */ }
    };

    const handleCancel = async () => {
        if (!activeTabId) return;
        try { await CancelQuery(activeTabId); } catch { /* swallow */ }
    };

    const handleSelectDb = async (profileName: string, dbName: string) => {
        setIsDropdownOpen(false);
        setHoveredConn(null);

        const isSameProfile = activeProfile?.name === profileName;
        const isSameDb = activeProfile?.db_name === dbName;

        if (isSameProfile && isSameDb) return;

        try {
            if (!isSameProfile) {
                // Connect to the new profile first, which uses its default DB
                await Connect(profileName);
            }
            // Then switch to the chosen DB
            if (!isSameDb || !isSameProfile) {
                await SwitchDatabase(dbName);
            }
        } catch (err) {
            console.error('Failed to switch connection/db:', err);
        }
    };

    // Build breadcrumb label
    let breadcrumbText = 'No Connection';
    if (isConnected && activeProfile) {
        const driverName = activeProfile.driver === 'postgres' ? 'PostgreSQL' : 'SQL Server';
        const hostShort = activeProfile.host.split('.')[0];
        breadcrumbText = `${driverName}  ·  ${hostShort}  ·  ${activeProfile.db_name}`;
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
                        onClick={() => {
                            setIsDropdownOpen(prev => !prev);
                            setHoveredConn(null);
                        }}
                    >
                        {breadcrumbText}
                        <ChevronDown size={14} className="breadcrumb-chevron" />
                    </div>

                    {isDropdownOpen && (
                        <div className="connection-dropdown">
                            <div className="dropdown-header">Select Connection · Database</div>
                            {connections.length === 0 ? (
                                <div className="dropdown-empty">No connections found</div>
                            ) : (
                                <div className="dropdown-list">
                                    {connections.map((conn) => {
                                        const isActive = activeProfile?.name === conn.name;
                                        const isHovered = hoveredConn === conn.name;
                                        // Only show databases submenu for the active connection
                                        const dbList = isActive ? databases : [];

                                        return (
                                            <div
                                                key={conn.name}
                                                className={`dropdown-item dropdown-item-has-sub ${isActive ? 'active' : ''} ${isHovered ? 'hovered' : ''}`}
                                                onMouseEnter={() => setHoveredConn(conn.name)}
                                                onMouseLeave={() => setHoveredConn(null)}
                                            >
                                                <div className="dropdown-item-content">
                                                    <div>
                                                        <div className="dropdown-item-name">{conn.name}</div>
                                                        <div className="dropdown-item-host">{conn.host}:{conn.port}</div>
                                                    </div>
                                                    <ChevronRight size={12} className="dropdown-item-arrow" />
                                                </div>

                                                {/* Submenu: DB list */}
                                                {isHovered && (
                                                    <div className="dropdown-submenu">
                                                        <div className="dropdown-header">Databases</div>
                                                        {dbList.length === 0 ? (
                                                            <div className="dropdown-empty" style={{ fontSize: 11 }}>
                                                                {isActive ? 'No databases' : 'Connect first to see databases'}
                                                            </div>
                                                        ) : (
                                                            <div className="dropdown-list">
                                                                {dbList.map((dbName) => (
                                                                    <div
                                                                        key={dbName}
                                                                        className={`dropdown-item ${isActive && activeProfile?.db_name === dbName ? 'active' : ''}`}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleSelectDb(conn.name, dbName);
                                                                        }}
                                                                    >
                                                                        <div className="dropdown-item-name">{dbName}</div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="toolbar-right">
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
