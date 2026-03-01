'use client';

import { useRef, useState } from 'react';
import { useWikiHistory } from '@/hooks/use-wiki-history';
import { WikiHistoryCard } from './wiki-history-card';

const PAGE_SIZE = 12;

export function WikiHistory() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data, isLoading, isError } = useWikiHistory(
    page,
    PAGE_SIZE,
    debouncedSearch || undefined,
  );

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 300);
  }

  const wikis = data?.data ?? [];
  const meta = data?.meta;
  const totalPages = meta?.totalPages ?? 1;

  return (
    <section>
      {/* Section header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '12px',
          gap: '16px',
          flexWrap: 'wrap',
        }}
      >
        <h2
          style={{
            fontSize: '12px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--text-secondary)',
            margin: 0,
          }}
        >
          Recent Wikis
        </h2>

        {/* Search input */}
        <input
          type="search"
          value={search}
          onChange={handleSearchChange}
          placeholder="Search repos..."
          style={{
            backgroundColor: 'var(--bg-input)',
            border: '1px solid var(--border-default)',
            color: 'var(--text-primary)',
            fontFamily: 'inherit',
            fontSize: '12px',
            padding: '6px 12px',
            outline: 'none',
            width: '220px',
            transition: 'border-color 0.15s ease',
          }}
          onFocus={(e) =>
            (e.currentTarget.style.borderColor = 'var(--accent)')
          }
          onBlur={(e) =>
            (e.currentTarget.style.borderColor = 'var(--border-default)')
          }
        />
      </div>

      {/* Loading state */}
      {isLoading && (
        <div
          style={{
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: '12px',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            padding: '40px 0',
          }}
        >
          Loading...
        </div>
      )}

      {/* Error state */}
      {isError && !isLoading && (
        <div
          style={{
            textAlign: 'center',
            color: '#8b3a3a',
            fontSize: '12px',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            padding: '40px 0',
          }}
        >
          ✗ Failed to load wikis
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && wikis.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: '12px',
            padding: '40px 0',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ marginBottom: '8px', fontSize: '20px' }}>▪</div>
          <p
            style={{
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              margin: 0,
            }}
          >
            {debouncedSearch
              ? 'No wikis match your search'
              : 'No wikis generated yet'}
          </p>
          {!debouncedSearch && (
            <p
              style={{
                color: 'var(--text-muted)',
                fontSize: '11px',
                marginTop: '6px',
              }}
            >
              Enter a GitHub repo above to get started
            </p>
          )}
        </div>
      )}

      {/* Grid */}
      {!isLoading && !isError && wikis.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: '12px',
          }}
        >
          {wikis.map((wiki) => (
            <WikiHistoryCard key={wiki.id} wiki={wiki} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {!isLoading && !isError && totalPages > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            marginTop: '20px',
          }}
        >
          <PaginationButton
            label="← PREV"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          />

          <span
            style={{
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--text-secondary)',
              padding: '0 8px',
            }}
          >
            {page} / {totalPages}
          </span>

          <PaginationButton
            label="NEXT →"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          />
        </div>
      )}
    </section>
  );
}

function PaginationButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        backgroundColor: 'transparent',
        border: `1px solid ${disabled ? 'var(--border-subtle)' : 'var(--border-default)'}`,
        color: disabled ? 'var(--text-muted)' : 'var(--text-secondary)',
        fontFamily: 'inherit',
        fontSize: '11px',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        padding: '6px 14px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s ease',
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.borderColor = 'var(--accent)';
          e.currentTarget.style.color = 'var(--text-primary)';
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          e.currentTarget.style.borderColor = 'var(--border-default)';
          e.currentTarget.style.color = 'var(--text-secondary)';
        }
      }}
    >
      {label}
    </button>
  );
}
