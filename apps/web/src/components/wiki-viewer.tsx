'use client';

import { useState } from 'react';
import Markdown from 'react-markdown';
import { WikiSidebar } from './wiki-sidebar';
import { WikiPageContent } from './wiki-page-content';
import { QaPanel } from './qa-panel';
import type { WikiResponse, WikiSubsystem } from '@/types/wiki.types';
import type { ComponentProps } from 'react';

interface WikiViewerProps {
  wiki: WikiResponse;
}

// Minimal markdown overrides for overview prose
const overviewMdComponents: ComponentProps<typeof Markdown>['components'] = {
  p: ({ children }) => (
    <p style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.7, marginBottom: '12px' }}>
      {children}
    </p>
  ),
  code: ({ children }) => (
    <code style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-accent)', fontSize: '12px', padding: '2px 6px', fontFamily: 'inherit' }}>
      {children}
    </code>
  ),
};

function OverviewContent({ wiki }: { wiki: WikiResponse }) {
  return (
    <article style={{ maxWidth: '800px' }}>
      <h1
        style={{
          fontSize: '18px',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--text-primary)',
          borderBottom: '1px solid var(--border-default)',
          paddingBottom: '12px',
          marginBottom: '20px',
        }}
      >
        {wiki.repoName}
      </h1>

      {/* Stats row */}
      <div
        style={{
          display: 'flex',
          gap: '0',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
          marginBottom: '24px',
        }}
      >
        {[
          { value: wiki.totalSubsystems, label: 'Subsystems' },
          { value: wiki.totalFiles, label: 'Files' },
          { value: wiki.branch, label: 'Branch', isText: true },
        ].map((stat, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              padding: '12px 16px',
              borderRight: i < 2 ? '1px solid var(--border-default)' : 'none',
            }}
          >
            <div
              style={{
                fontSize: stat.isText ? '16px' : '28px',
                fontWeight: 700,
                color: i === 0 ? 'var(--text-accent)' : 'var(--text-primary)',
                lineHeight: 1,
                marginBottom: '4px',
              }}
            >
              {stat.value}
            </div>
            <div
              style={{
                fontSize: '10px',
                fontWeight: 400,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                color: 'var(--text-secondary)',
              }}
            >
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Repo summary */}
      {wiki.repoSummary && (
        <div>
          <div
            style={{
              fontSize: '10px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              color: 'var(--text-secondary)',
              marginBottom: '10px',
              paddingBottom: '6px',
              borderBottom: '1px solid var(--border-subtle)',
            }}
          >
            Repository Summary
          </div>
          <Markdown components={overviewMdComponents}>{wiki.repoSummary}</Markdown>
        </div>
      )}

      {/* Subsystem index */}
      {wiki.subsystems.length > 0 && (
        <div style={{ marginTop: '24px' }}>
          <div
            style={{
              fontSize: '10px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              color: 'var(--text-secondary)',
              marginBottom: '10px',
              paddingBottom: '6px',
              borderBottom: '1px solid var(--border-subtle)',
            }}
          >
            Subsystems ({wiki.subsystems.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {[...wiki.subsystems]
              .sort((a, b) => a.displayOrder - b.displayOrder)
              .map((s) => (
                <div
                  key={s.id}
                  style={{
                    fontSize: '12px',
                    color: 'var(--text-secondary)',
                    padding: '4px 0',
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: '8px',
                  }}
                >
                  <span style={{ color: 'var(--accent)', flexShrink: 0 }}>▪</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {s.name}
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                    — {s.description}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </article>
  );
}

export function WikiViewer({ wiki }: WikiViewerProps) {
  // null = overview, 'qa' = Q&A panel, else subsystem id
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedSubsystem: WikiSubsystem | undefined =
    selectedId && selectedId !== 'qa'
      ? wiki.subsystems.find((s) => s.id === selectedId)
      : undefined;

  function handleNavigate(nameOrId: string) {
    const found = wiki.subsystems.find(
      (s) => s.id === nameOrId || s.name === nameOrId,
    );
    if (found) setSelectedId(found.id);
  }

  return (
    <div
      style={{
        display: 'flex',
        height: '100%',
        overflow: 'hidden',
        backgroundColor: 'var(--bg-primary)',
      }}
    >
      {/* Sidebar */}
      <WikiSidebar
        wiki={wiki}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />

      {/* Content + Q&A area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
        }}
      >
        {/* Main content */}
        <div
          style={{
            flex: 1,
            padding: '24px 32px',
            maxWidth: '800px',
            width: '100%',
          }}
        >
          {selectedId === 'qa' ? (
            <div>
              <h1
                style={{
                  fontSize: '18px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--text-primary)',
                  borderBottom: '1px solid var(--border-default)',
                  paddingBottom: '12px',
                  marginBottom: '20px',
                }}
              >
                Ask a Question
              </h1>
              <p
                style={{
                  fontSize: '13px',
                  color: 'var(--text-secondary)',
                  marginBottom: '16px',
                  lineHeight: 1.6,
                }}
              >
                Ask anything about{' '}
                <span style={{ color: 'var(--text-primary)' }}>{wiki.repoName}</span>.
                The answer is generated from the wiki content using RAG.
              </p>
              <QaPanel wikiId={wiki.id} />
            </div>
          ) : selectedSubsystem ? (
            <WikiPageContent
              subsystem={selectedSubsystem}
              onNavigate={handleNavigate}
            />
          ) : (
            <OverviewContent wiki={wiki} />
          )}
        </div>

        {/* Q&A panel at bottom (hidden when Q&A section is active) */}
        {selectedId !== 'qa' && (
          <div style={{ flexShrink: 0 }}>
            <QaPanel wikiId={wiki.id} />
          </div>
        )}
      </div>
    </div>
  );
}
