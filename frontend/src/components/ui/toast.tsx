import * as React from 'react';
import * as ToastPrimitives from '@radix-ui/react-toast';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

const ToastProvider = ToastPrimitives.Provider;

const ToastViewport = React.forwardRef<
    React.ElementRef<typeof ToastPrimitives.Viewport>,
    React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
    <ToastPrimitives.Viewport
        ref={ref}
        className={cn('pointer-events-none fixed z-toast flex flex-col gap-2.5 outline-none', className)}
        {...props}
    />
));
ToastViewport.displayName = ToastPrimitives.Viewport.displayName;

const Toast = React.forwardRef<
    React.ElementRef<typeof ToastPrimitives.Root>,
    React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root>
>(({ className, ...props }, ref) => (
    <ToastPrimitives.Root
        ref={ref}
        className={cn(
            'pointer-events-auto flex min-w-[250px] max-w-[400px] items-start gap-2.5 rounded-sm border border-border border-l-4 bg-background px-4 py-3 text-[13px] shadow-elevation-md',
            className,
        )}
        {...props}
    />
));
Toast.displayName = ToastPrimitives.Root.displayName;

const ToastDescription = React.forwardRef<
    React.ElementRef<typeof ToastPrimitives.Description>,
    React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
    <ToastPrimitives.Description
        ref={ref}
        className={cn('flex-1 break-words leading-normal text-foreground', className)}
        {...props}
    />
));
ToastDescription.displayName = ToastPrimitives.Description.displayName;

const ToastClose = React.forwardRef<
    React.ElementRef<typeof ToastPrimitives.Close>,
    React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, children, ...props }, ref) => (
    <ToastPrimitives.Close
        ref={ref}
        className={cn('shrink-0 -mt-1 -mr-1 rounded-sm p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground', className)}
        {...props}
    >
        {children ?? <X size={14} />}
    </ToastPrimitives.Close>
));
ToastClose.displayName = ToastPrimitives.Close.displayName;

export {
    ToastProvider,
    ToastViewport,
    Toast,
    ToastDescription,
    ToastClose,
};
