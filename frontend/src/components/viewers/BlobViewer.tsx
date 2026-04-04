import React, { useState, useMemo } from 'react';
import { Download, File, Image as ImageIcon } from 'lucide-react';
import { Button } from '../ui';

interface BlobViewerProps {
    value: string;
    columnType?: string;
    className?: string;
}

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'];
const IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml'];

const detectImageType = (value: string, columnType?: string): boolean => {
    const lowerType = columnType?.toLowerCase() || '';
    const lowerVal = value.toLowerCase().trim();

    if (IMAGE_MIMES.some((mime) => lowerType.includes(mime))) return true;
    if (lowerType.includes('bytea') || lowerType.includes('blob') || lowerType.includes('binary')) {
        const base64Match = value.match(/^data:([^;]+);base64,/);
        if (base64Match && IMAGE_MIMES.some((mime) => base64Match[1].includes(mime.split('/')[1]))) {
            return true;
        }
    }

    if (value.length > 8 && !value.includes(' ') && !value.includes('\n')) {
        const ext = lowerVal.split('.').pop();
        if (ext && IMAGE_EXTENSIONS.includes(ext)) return true;
    }

    return false;
};

const getByteSize = (value: string): number => {
    try {
        const base64Match = value.match(/^data:[^;]+;base64,(.+)$/);
        if (base64Match) {
            return atob(base64Match[1]).length;
        }
        return new Blob([value]).size;
    } catch {
        return value.length;
    }
};

const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

interface ImagePreviewProps {
    value: string;
    onDownload: () => void;
}

const ImagePreview: React.FC<ImagePreviewProps> = ({ value, onDownload }) => {
    const [showFull, setShowFull] = useState(false);
    const [error, setError] = useState(false);

    const src = useMemo(() => {
        if (value.startsWith('data:')) return value;
        if (value.length > 100) {
            return `data:image/png;base64,${value}`;
        }
        return value;
    }, [value]);

    if (error) {
        return (
            <div className="blob-image-error">
                <ImageIcon size={16} />
                <span>Failed to load image</span>
            </div>
        );
    }

    return (
        <div className="blob-image-container">
            <div className="blob-image-wrapper" onClick={() => setShowFull(true)}>
                <img
                    src={src}
                    alt="Preview"
                    className="blob-image-preview"
                    onError={() => setError(true)}
                />
            </div>
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className="blob-download-btn"
                onClick={(event) => {
                    event.stopPropagation();
                    onDownload();
                }}
                title="Download"
            >
                <Download size={12} />
            </Button>

            {showFull && (
                <div className="blob-image-modal" onClick={() => setShowFull(false)}>
                    <img src={src} alt="Full size" className="blob-image-full" />
                </div>
            )}
        </div>
    );
};

export const BlobViewer: React.FC<BlobViewerProps> = ({ value, columnType, className = '' }) => {
    const [showPreview, setShowPreview] = useState(false);

    const isImage = useMemo(() => detectImageType(value, columnType), [value, columnType]);
    const byteSize = useMemo(() => getByteSize(value), [value]);

    const handleDownload = async () => {
        try {
            const blob = new Blob([value], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `blob_${Date.now()}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Download failed:', err);
        }
    };

    if (!value || value === '\x00' || value === '') {
        return <span className={`blob-empty ${className}`}>NULL</span>;
    }

    if (isImage) {
        return (
            <div className={`blob-viewer ${className}`}>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="blob-preview-btn"
                    onClick={() => setShowPreview(true)}
                    title="Preview image"
                >
                    <ImageIcon size={14} />
                    <span>{formatBytes(byteSize)}</span>
                </Button>

                {showPreview && (
                    <div className="blob-modal-overlay" onClick={() => setShowPreview(false)}>
                        <div className="blob-modal-content" onClick={(event) => event.stopPropagation()}>
                            <div className="blob-modal-header">
                                <span>Image Preview</span>
                                <Button type="button" variant="ghost" size="icon" onClick={() => setShowPreview(false)}>
                                    x
                                </Button>
                            </div>
                            <ImagePreview value={value} onDownload={handleDownload} />
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className={`blob-viewer blob-generic ${className}`}>
            <div className="blob-info">
                <File size={14} />
                <span>{formatBytes(byteSize)}</span>
            </div>
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className="blob-download-btn"
                onClick={handleDownload}
                title="Download binary data"
            >
                <Download size={12} />
            </Button>
        </div>
    );
};

export const isBlobValue = (value: string, columnType?: string): boolean => {
    if (!value) return false;
    const lowerType = columnType?.toLowerCase() || '';
    if (lowerType.includes('bytea') || lowerType.includes('blob') || lowerType.includes('binary') || lowerType.includes('byte')) {
        return true;
    }
    return detectImageType(value, columnType);
};
