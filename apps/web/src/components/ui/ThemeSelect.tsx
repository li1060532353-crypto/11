import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

type Option = { value: string; label: string };
type ThemeSelectProps = { label: string; value: string; options: readonly Option[]; onChange: (value: string) => void };

export function ThemeSelect({ label, value, options, onChange }: ThemeSelectProps) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const selected = Math.max(0, options.findIndex((option) => option.value === value));
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(selected);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);
  useEffect(() => {
    if (open) document.getElementById(`${id}-option-${active}`)?.scrollIntoView?.({ block: 'nearest' });
  }, [active, open, id]);
  const choose = (index: number) => {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    setOpen(false);
    trigger.current?.focus();
  };
  const keyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Escape') { event.preventDefault(); setOpen(false); return; }
    if (event.key === 'Tab') { setOpen(false); return; }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setActive(open ? Math.max(0, Math.min(options.length - 1, active + (event.key === 'ArrowDown' ? 1 : -1))) : selected);
      setOpen(true);
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault(); setOpen(true); setActive(event.key === 'Home' ? 0 : options.length - 1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (open) choose(active); else { setActive(selected); setOpen(true); }
    }
  };
  return (
    <div className="theme-select" ref={root} onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false);
    }}>
      <span id={`${id}-label`} className="theme-select__label">{label}</span>
      <button ref={trigger} type="button" className="theme-select__trigger" role="combobox"
        aria-labelledby={`${id}-label`} aria-expanded={open} aria-haspopup="listbox"
        aria-controls={`${id}-list`} aria-activedescendant={open ? `${id}-option-${active}` : undefined}
        onKeyDown={keyDown} onClick={() => { setActive(selected); setOpen(!open); }}>
        <span>{options[selected]?.label}</span>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" /></svg>
      </button>
      {open ? <div className="theme-select__menu" role="listbox" id={`${id}-list`} aria-labelledby={`${id}-label`}>
        {options.map((option, index) => <div key={option.value} role="option" id={`${id}-option-${index}`}
          aria-selected={option.value === value} data-active={index === active}
          className="theme-select__option" onPointerMove={() => setActive(index)}
          onMouseDown={(event) => event.preventDefault()} onClick={() => choose(index)}>
          <span>{option.label}</span><span aria-hidden="true">{option.value === value ? '✓' : ''}</span>
        </div>)}
      </div> : null}
    </div>
  );
}
