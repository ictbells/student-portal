import { useEffect, useId, useMemo, useRef, useState } from 'react';

export type SearchableOption = {
  value: number | string;
  label: string;
  keywords?: string;
  hint?: string;
};

export function SearchableSelect({
  id,
  value,
  options,
  onChange,
  placeholder = 'Search…',
  disabled = false,
  allowClear = false,
  emptyText = 'No matches',
}: {
  id?: string;
  value: number | string | '' | null;
  options: SearchableOption[];
  onChange: (value: number | string | '') => void;
  placeholder?: string;
  disabled?: boolean;
  allowClear?: boolean;
  emptyText?: string;
}) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const selected = options.find((option) => String(option.value) === String(value ?? '')) || null;
  const display = open ? query : (selected?.label || '');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((option) => {
      const haystack = `${option.label} ${option.keywords || ''} ${option.hint || ''}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query, open]);

  const pick = (option: SearchableOption | null) => {
    onChange(option ? option.value : '');
    setOpen(false);
    setQuery('');
  };

  return (
    <div className="relative" ref={rootRef}>
      <input
        id={inputId}
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls={`${inputId}-list`}
        disabled={disabled}
        autoComplete="off"
        placeholder={placeholder}
        value={display}
        onFocus={() => {
          if (disabled) return;
          setOpen(true);
          setQuery('');
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          if (!open) setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setOpen(true);
            setActive((index) => Math.min(index + 1, Math.max(filtered.length - 1, 0)));
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActive((index) => Math.max(index - 1, 0));
          } else if (event.key === 'Enter' && open) {
            event.preventDefault();
            const option = filtered[active];
            if (option) pick(option);
          }
        }}
        className="w-full border border-slate-200 rounded-lg px-3 py-2.5 pr-16 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 transition disabled:bg-slate-50 disabled:text-slate-400"
      />
      {allowClear && selected && !disabled && (
        <button
          type="button"
          className="absolute right-8 top-1/2 -translate-y-1/2 h-8 w-8 text-slate-400 hover:text-slate-700 touch-manipulation"
          aria-label="Clear selection"
          onClick={() => pick(null)}
        >
          ×
        </button>
      )}
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden>
        ▾
      </span>
      {open && !disabled && (
        <ul
          id={`${inputId}-list`}
          role="listbox"
          className="absolute z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2.5 text-sm text-slate-500">{emptyText}</li>
          ) : (
            filtered.map((option, index) => (
              <li key={String(option.value)} role="option" aria-selected={String(option.value) === String(value ?? '')}>
                <button
                  type="button"
                  className={`flex w-full flex-col items-start px-3 py-2 text-left text-sm ${
                    index === active ? 'bg-sky-50 text-sky-900' : 'text-slate-800 hover:bg-slate-50'
                  }`}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => pick(option)}
                >
                  <span>{option.label}</span>
                  {option.hint && <span className="mt-0.5 text-xs text-slate-500">{option.hint}</span>}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
