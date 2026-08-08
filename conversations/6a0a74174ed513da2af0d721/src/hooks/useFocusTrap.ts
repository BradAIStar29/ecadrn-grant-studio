import { useEffect, RefObject } from 'react';

/**
 * Focus trap hook for modal dialogs.
 * 
 * - When `active` is true, traps keyboard focus within the container element.
 * - Tab/Shift+Tab cycles through focusable elements inside the container.
 * - Pressing Escape calls `onEscape` (typically closes the modal).
 * - On activation, focus moves to the first focusable element (or the container itself).
 * - On deactivation, focus is NOT restored (caller can handle if needed).
 * 
 * Usage:
 *   const ref = useRef<HTMLDivElement>(null);
 *   useFocusTrap(ref, isModalOpen, () => setModalOpen(false));
 *   <div ref={ref} role="dialog" aria-modal="true">...</div>
 */
export function useFocusTrap(
  ref: RefObject<HTMLElement>,
  active: boolean,
  onEscape?: () => void
) {
  useEffect(() => {
    if (!active || !ref.current) return;

    const container = ref.current;

    // Selector for all focusable elements
    const FOCUSABLE = [
      'a[href]',
      'button:not([disabled])',
      'textarea',
      'input:not([type="hidden"])',
      'select',
      '[tabindex]:not([tabindex="-1"])',
    ].join(', ');

    const getFocusable = (): HTMLElement[] => {
      return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter(el => el.offsetParent !== null || el === document.activeElement);
    };

    // Move focus into the container on open
    const focusable = getFocusable();
    if (focusable.length > 0) {
      // Slight delay to ensure the modal is rendered
      setTimeout(() => focusable[0]?.focus(), 50);
    } else {
      container.setAttribute('tabindex', '-1');
      container.focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onEscape?.();
        return;
      }

      if (e.key !== 'Tab') return;

      const elements = getFocusable();
      if (elements.length === 0) {
        e.preventDefault();
        return;
      }

      const first = elements[0];
      const last = elements[elements.length - 1];
      const activeEl = document.activeElement;

      if (e.shiftKey) {
        if (activeEl === first || !container.contains(activeEl)) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (activeEl === last || !container.contains(activeEl)) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => {
      container.removeEventListener('keydown', handleKeyDown);
      if (container.getAttribute('tabindex') === '-1') {
        container.removeAttribute('tabindex');
      }
    };
  }, [active, ref, onEscape]);
}
