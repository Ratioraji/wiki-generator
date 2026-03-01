'use client';

import { useState } from 'react';
import { SearchBar } from './search-bar';
import type { WikiResponse, WikiSubsystem } from '@/types/wiki.types';

interface WikiSidebarProps {
  wiki: WikiResponse;
  selectedId: string | null; // null = overview, 'qa' = Q&A panel
  onSelect: (id: string | null) => void;
}

export function WikiSidebar({ wiki, selectedId, onSelect }: WikiSidebarProps) {
  const [search, setSearch] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);

  const subsystems = [...wiki.subsystems].sort(
    (a, b) => a.displayOrder - b.displayOrder,
  );

  const filtered = search
    ? subsystems.filter((s) =>
        s.name.toLowerCase().includes(search.toLowerCase()),
      )
    : subsystems;

  function isMatch(s: WikiSubsystem) {
    return search ? s.name.toLowerCase().includes(search.toLowerCase()) : false;
  }

  const sidebarContent = (
    <nav
      style={{
        backgroundColor: 'var(--bg-card)',
        borderRight: '1px solid var(--border-default)',
        width: '250px',
        flexShrink: 0,
        height: '100vh',
        position: 'sticky',
        top: 0,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Wiki title */}
      <div
        style={{
          padding: '16px',
          borderBottom: '1px solid var(--border-default)',
        }}
      >
        <div
          style={{
            fontSize: '12px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--text-primary)',
            marginBottom: '6px',
            wordBreak: 'break-all',
          }}
        >
          {wiki.repoName}
        </div>
        <span
          style={{
            backgroundColor: 'var(--accent-muted)',
            border: '1px solid var(--border-accent)',
            color: 'var(--text-accent)',
            fontSize: '10px',
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            padding: '2px 8px',
            display: 'inline-block',
          }}
        >
          {wiki.branch}
        </span>
      </div>

      {/* Search */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
        <SearchBar value={search} onChange={setSearch} placeholder="Filter subsystems..." />
      </div>

      {/* Overview link */}
      <button
        onClick={() => onSelect(null)}
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'left',
          backgroundColor:
            selectedId === null ? 'var(--bg-elevated)' : 'transparent',
          border: 'none',
          borderLeft:
            selectedId === null
              ? '2px solid var(--accent)'
              : '2px solid transparent',
          padding: '8px 16px',
          fontSize: '12px',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color:
            selectedId === null
              ? 'var(--text-accent)'
              : 'var(--text-secondary)',
          fontFamily: 'inherit',
          cursor: 'pointer',
          transition: 'all 0.1s ease',
        }}
        onMouseEnter={(e) => {
          if (selectedId !== null) {
            e.currentTarget.style.backgroundColor = 'var(--bg-elevated)';
            e.currentTarget.style.color = 'var(--text-primary)';
          }
        }}
        onMouseLeave={(e) => {
          if (selectedId !== null) {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }
        }}
      >
        Overview
      </button>

      {/* Divider */}
      <div
        style={{
          height: '1px',
          backgroundColor: 'var(--border-subtle)',
          margin: '4px 0',
        }}
      />

      {/* Subsystem list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filtered.length === 0 && search && (
          <div
            style={{
              padding: '8px 16px',
              fontSize: '11px',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            No match
          </div>
        )}
        {filtered.map((s) => {
          const isActive = selectedId === s.id;
          const matches = isMatch(s);

          return (
            <button
              key={s.id}
              onClick={() => onSelect(s.id)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                backgroundColor: isActive ? 'var(--bg-elevated)' : 'transparent',
                border: 'none',
                borderLeft: isActive
                  ? '2px solid var(--accent)'
                  : '2px solid transparent',
                padding: '8px 16px',
                fontSize: '12px',
                color: isActive
                  ? 'var(--text-accent)'
                  : matches
                    ? 'var(--text-accent)'
                    : 'var(--text-secondary)',
                fontFamily: 'inherit',
                cursor: 'pointer',
                transition: 'all 0.1s ease',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'var(--bg-elevated)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = matches
                    ? 'var(--text-accent)'
                    : 'var(--text-secondary)';
                }
              }}
            >
              {s.name}
            </button>
          );
        })}
      </div>

      {/* Divider */}
      <div style={{ height: '1px', backgroundColor: 'var(--border-subtle)' }} />

      {/* Q&A link */}
      <button
        onClick={() => onSelect('qa')}
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'left',
          backgroundColor:
            selectedId === 'qa' ? 'var(--bg-elevated)' : 'transparent',
          border: 'none',
          borderLeft:
            selectedId === 'qa'
              ? '2px solid var(--accent)'
              : '2px solid transparent',
          padding: '8px 16px',
          fontSize: '12px',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color:
            selectedId === 'qa'
              ? 'var(--text-accent)'
              : 'var(--text-secondary)',
          fontFamily: 'inherit',
          cursor: 'pointer',
          transition: 'all 0.1s ease',
        }}
        onMouseEnter={(e) => {
          if (selectedId !== 'qa') {
            e.currentTarget.style.backgroundColor = 'var(--bg-elevated)';
            e.currentTarget.style.color = 'var(--text-primary)';
          }
        }}
        onMouseLeave={(e) => {
          if (selectedId !== 'qa') {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }
        }}
      >
        Q&A
      </button>
    </nav>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen((v) => !v)}
        aria-label="Toggle sidebar"
        style={{
          display: 'none',
          position: 'fixed',
          top: '12px',
          left: '12px',
          zIndex: 50,
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
          color: 'var(--text-primary)',
          fontFamily: 'inherit',
          fontSize: '12px',
          padding: '6px 12px',
          cursor: 'pointer',
        }}
        className="mobile-sidebar-toggle"
      >
        {mobileOpen ? '✗' : '☰'}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 40,
            backgroundColor: 'rgba(0,0,0,0.6)',
          }}
          className="mobile-overlay"
        />
      )}

      {/* Sidebar wrapper — desktop: static, mobile: fixed overlay */}
      <div
        style={{ display: 'contents' }}
        className={`sidebar-wrapper${mobileOpen ? ' sidebar-mobile-open' : ''}`}
      >
        {sidebarContent}
      </div>
    </>
  );
}
