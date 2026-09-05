import { useEffect, useRef, useState } from 'react';
import {
  canShareNatively,
  copyText,
  listShareText,
  mailtoHref,
  shareNatively,
  shareSubject,
  smsHref,
  type Shareable,
} from '../utils/share';

interface Props {
  listings: Shareable[];
  /** Shown on the button; the menu items are always the same. */
  label?: string;
  compact?: boolean;
}

/**
 * The phone's own share sheet is the best answer when there is one, but it does
 * not exist on a desktop browser, so text / email / copy are always offered too.
 */
export function ShareButton({ listings, label = 'Share', compact = false }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  if (listings.length === 0) return null;

  const text = listShareText(listings);
  const subject = shareSubject(listings);

  async function openShareSheet() {
    setOpen(false);
    await shareNatively(subject, text);
  }

  async function copy() {
    setOpen(false);
    setCopied(await copyText(text));
    setTimeout(() => setCopied(false), 2500);
  }

  const item =
    'block w-full text-left px-3 py-2 text-xs hover:bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]';

  return (
    <div className="relative inline-block" ref={box}>
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`inline-flex items-center gap-1 rounded-lg border font-medium ${
          compact ? 'text-xs px-2 py-1' : 'text-xs px-3 py-1.5'
        }`}
        style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <path strokeLinecap="round" d="M8.6 10.6l6.8-4M8.6 13.4l6.8 4" />
        </svg>
        {copied ? 'Copied' : label}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1 w-44 rounded-lg border overflow-hidden shadow-lg"
          style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
        >
          {canShareNatively() && (
            <button type="button" role="menuitem" className={item} onClick={() => void openShareSheet()}>
              Share…
            </button>
          )}
          <a role="menuitem" className={item} href={smsHref(text)} onClick={() => setOpen(false)}>
            Text message
          </a>
          <a role="menuitem" className={item} href={mailtoHref(subject, text)} onClick={() => setOpen(false)}>
            Email
          </a>
          <button type="button" role="menuitem" className={item} onClick={() => void copy()}>
            Copy to clipboard
          </button>
        </div>
      )}
    </div>
  );
}
