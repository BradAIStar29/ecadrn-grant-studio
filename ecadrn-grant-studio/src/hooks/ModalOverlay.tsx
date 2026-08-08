import { useRef, ReactNode, MouseEvent } from 'react';
import { useFocusTrap } from './useFocusTrap';

interface ModalOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  /** Width class for the inner panel, e.g. 'max-w-lg' */
  panelClassName?: string;
  /** If true, clicking the overlay closes the modal (default: true) */
  closeOnOverlayClick?: boolean;
}

/**
 * Reusable modal overlay with focus trapping, Escape-to-close,
 * and click-outside-to-close built in.
 * 
 * Usage:
 *   <ModalOverlay isOpen={showSettings} onClose={() => setShowSettings(false)} panelClassName="max-w-lg">
 *     ...modal content...
 *   </ModalOverlay>
 */
export function ModalOverlay({
  isOpen,
  onClose,
  children,
  className = '',
  panelClassName = 'max-w-2xl',
  closeOnOverlayClick = true,
}: ModalOverlayProps) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, isOpen, onClose);

  if (!isOpen) return null;

  const handleOverlayClick = (e: MouseEvent<HTMLDivElement>) => {
    if (closeOnOverlayClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      ref={ref}
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm ${className}`}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
    >
      <div className={`bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full mx-4 max-h-[85vh] overflow-y-auto border border-slate-200 dark:border-slate-700 ${panelClassName}`}>
        {children}
      </div>
    </div>
  );
}
