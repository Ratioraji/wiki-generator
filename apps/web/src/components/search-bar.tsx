'use client';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChange, placeholder = 'Filter...' }: SearchBarProps) {
  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: '100%',
        backgroundColor: 'var(--bg-primary)',
        border: '1px solid var(--border-default)',
        color: 'var(--text-primary)',
        fontFamily: 'inherit',
        fontSize: '12px',
        padding: '6px 10px',
        outline: 'none',
        transition: 'border-color 0.15s ease',
        boxSizing: 'border-box',
      }}
      onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
      onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-default)')}
    />
  );
}
