import { useEffect, RefObject } from 'react';

export function useFocusTrap(
  ref: RefObject<HTMLElement>,
  active: boolean,
  onEscape?: () => void
) {
  useEffect(() => {
    if (!active || !ref.current) return;

    const container = ref.current;

    const FOCUSABLE = [
      'a[href]',
      'button:not([disabled])',
      'textarea',
      'input:not([type="hidden"])',
      'select',
      '[tabindex]:not([tabindex="-1"])',
    ].join(', ');

    const getFocusable = (): HTMLElement[] => {
      const nodes = container.querySelectorAll(FOCUSABLE);
      const result: HTMLElement[] = [];
      nodes.forEach((node) => {
        const el = node as HTMLElement;
        if (el.offsetParent !== null || el === document.activeElement) {
          result.push(el);
        }
      });
      return result;
    };

    const focusable = getFocusable();
    if (focusable.length > 0) {
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
