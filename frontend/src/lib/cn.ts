import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility for constructing class name strings conditionally.
 * Combines clsx (conditional joining) with tailwind-merge (conflict resolution).
 *
 * Usage:
 *   cn('flex gap-2', isActive && 'text-success')
 *   cn('p-2', large ? 'p-4' : 'p-2')
 */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}
