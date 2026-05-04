import { useEffect } from 'react';
import { registerContextAwareSQLCompletion } from '../../../lib/monaco/sqlCompletion';

export function useEditorSqlCompletion(monaco: any) {
    useEffect(() => {
        if (!monaco) return;
        const registration = registerContextAwareSQLCompletion(monaco);
        return () => registration.dispose();
    }, [monaco]);
}
