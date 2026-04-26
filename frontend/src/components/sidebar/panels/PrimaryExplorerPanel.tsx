import React from 'react';
import { useConnectionStore } from '../../../stores/connectionStore';
import { ConnectionTree } from '../ConnectionTree';

export const PrimaryExplorerPanel: React.FC = () => {
    const isConnected = useConnectionStore((state) => state.isConnected);

    if (isConnected) {
        return <ConnectionTree />;
    }

    return null;
};
