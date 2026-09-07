import { useEffect, useRef, type ReactNode } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  /** The control that opens the popover; kept in the same wrapper so outside clicks are detected. */
  trigger: ReactNode;
  children: ReactNode;
  align?: 'left' | 'right';
  className?: string;
}

/** A dropdown panel anchored to its trigger; closes on outside click or Escape. */
export function Popover({ open, onClose, trigger, children, align = 'left', className = '' }: Props) {
  const wrapper = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (wrapper.current && !wrapper.current.contains(event.target as Node)) onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  return (
    <div ref={wrapper} className="relative">
      {trigger}
      {open && (
        <div
          className={`card absolute z-40 mt-2 p-4 ${align === 'right' ? 'right-0' : 'left-0'} ${className}`}
          style={{ boxShadow: 'var(--shadow-lg)' }}
          role="dialog"
        >
          {children}
        </div>
      )}
    </div>
  );
}
