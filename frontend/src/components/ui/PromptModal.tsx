import React from 'react';
import { Modal } from '../layout/Modal';
import { Button } from './Button';
import { Input } from './Input';

interface PromptModalProps {
    isOpen: boolean;
    title?: string;
    message: string;
    defaultValue?: string;
    placeholder?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onCancel: () => void;
    onConfirm: (value: string) => void | Promise<void>;
}

export const PromptModal: React.FC<PromptModalProps> = ({
    isOpen,
    title = 'Input Required',
    message,
    defaultValue = '',
    placeholder,
    confirmLabel = 'Save',
    cancelLabel = 'Cancel',
    onCancel,
    onConfirm,
}) => {
    const [value, setValue] = React.useState(defaultValue);

    React.useEffect(() => {
        if (isOpen) {
            setValue(defaultValue);
        }
    }, [defaultValue, isOpen]);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onCancel}
            title={title}
            width={480}
            layer="confirm"
            footer={
                <>
                    <Button variant="ghost" onClick={onCancel} className="px-4">
                        {cancelLabel}
                    </Button>
                    <Button
                        variant="default"
                        onClick={() => onConfirm(value)}
                        autoFocus
                        className="px-4"
                    >
                        {confirmLabel}
                    </Button>
                </>
            }
        >
            <div className="space-y-3">
                <p className="text-[13px] text-text-primary">{message}</p>
                <Input
                    value={value}
                    placeholder={placeholder}
                    onChange={(event) => setValue(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                            event.preventDefault();
                            void onConfirm(value);
                        }
                    }}
                />
            </div>
        </Modal>
    );
};
