'use client';

import Markdown from 'react-markdown';
import { CodeCitation } from './code-citation';
import type { WikiSubsystem } from '@/types/wiki.types';
import type { ComponentProps } from 'react';

interface WikiPageContentProps {
  subsystem: WikiSubsystem;
  onNavigate?: (subsystemId: string) => void;
}

// Shared markdown component overrides — dark terminal design system rules
const mdComponents: ComponentProps<typeof Markdown>['components'] = {
  h1: ({ children }) => (
    <h1
      style={{
        fontSize: '18px',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: 'var(--text-primary)',
        borderBottom: '1px solid var(--border-default)',
        paddingBottom: '8px',
        marginBottom: '16px',
        marginTop: '24px',
      }}
    >
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2
      style={{
        fontSize: '14px',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: 'var(--text-secondary)',
        marginTop: '20px',
        marginBottom: '10px',
      }}
    >
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3
      style={{
        fontSize: '13px',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: 'var(--text-secondary)',
        marginTop: '16px',
        marginBottom: '8px',
      }}
    >
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p
      style={{
        fontSize: '13px',
        color: 'var(--text-primary)',
        lineHeight: 1.7,
        marginBottom: '12px',
      }}
    >
      {children}
    </p>
  ),
  code: ({ children, className }) => {
    const isBlock = className?.startsWith('language-');
    if (isBlock) {
      return (
        <code
          style={{
            fontFamily: 'inherit',
            fontSize: '12px',
            color: 'var(--text-primary)',
          }}
        >
          {children}
        </code>
      );
    }
    return (
      <code
        style={{
          backgroundColor: 'var(--bg-card)',
          color: 'var(--text-accent)',
          fontSize: '12px',
          padding: '2px 6px',
          fontFamily: 'inherit',
        }}
      >
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre
      style={{
        backgroundColor: 'var(--bg-card-inner)',
        border: '1px solid var(--border-default)',
        padding: '12px 16px',
        fontSize: '12px',
        overflowX: 'auto',
        marginBottom: '16px',
        fontFamily: 'inherit',
      }}
    >
      {children}
    </pre>
  ),
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        color: 'var(--text-accent)',
        textDecoration: 'none',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
      onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
    >
      {children}
    </a>
  ),
  ul: ({ children }) => (
    <ul
      style={{
        color: 'var(--text-primary)',
        fontSize: '13px',
        paddingLeft: '20px',
        marginBottom: '12px',
        listStyleType: 'none',
      }}
    >
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol
      style={{
        color: 'var(--text-primary)',
        fontSize: '13px',
        paddingLeft: '20px',
        marginBottom: '12px',
      }}
    >
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li
      style={{
        marginBottom: '4px',
        lineHeight: 1.6,
        paddingLeft: '4px',
        position: 'relative',
      }}
    >
      <span
        style={{
          color: 'var(--accent)',
          marginRight: '8px',
          position: 'absolute',
          left: '-14px',
        }}
      >
        ▪
      </span>
      {children}
    </li>
  ),
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
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
      {children}
    </div>
  );
}

export function WikiPageContent({ subsystem, onNavigate }: WikiPageContentProps) {
  return (
    <article style={{ maxWidth: '800px' }}>
      {/* Title */}
      <h1
        style={{
          fontSize: '18px',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--text-primary)',
          borderBottom: '1px solid var(--border-default)',
          paddingBottom: '12px',
          marginBottom: '8px',
        }}
      >
        {subsystem.name}
      </h1>

      {/* Description */}
      <p
        style={{
          fontSize: '13px',
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
          marginBottom: '24px',
        }}
      >
        {subsystem.description}
      </p>

      {/* Overview */}
      {subsystem.overview && (
        <section style={{ marginBottom: '24px' }}>
          <SectionLabel>Overview</SectionLabel>
          <Markdown components={mdComponents}>{subsystem.overview}</Markdown>
        </section>
      )}

      {/* How It Works */}
      {subsystem.howItWorks && (
        <section style={{ marginBottom: '24px' }}>
          <SectionLabel>How It Works</SectionLabel>
          <Markdown components={mdComponents}>{subsystem.howItWorks}</Markdown>
        </section>
      )}

      {/* Public Interfaces */}
      {subsystem.publicInterfaces.length > 0 && (
        <section style={{ marginBottom: '24px' }}>
          <SectionLabel>Public Interfaces</SectionLabel>
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '12px',
                fontFamily: 'inherit',
              }}
            >
              <thead>
                <tr>
                  {['Name', 'Type', 'Signature', 'Description', 'File'].map(
                    (col) => (
                      <th
                        key={col}
                        style={{
                          textAlign: 'left',
                          padding: '6px 10px',
                          fontSize: '10px',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.1em',
                          color: 'var(--text-secondary)',
                          borderBottom: '1px solid var(--border-default)',
                          backgroundColor: 'var(--bg-card)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {col}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {subsystem.publicInterfaces.map((iface, i) => (
                  <tr
                    key={i}
                    style={{
                      backgroundColor:
                        i % 2 === 0
                          ? 'var(--bg-card-inner)'
                          : 'var(--bg-card)',
                    }}
                  >
                    <td
                      style={{
                        padding: '6px 10px',
                        color: 'var(--text-primary)',
                        fontWeight: 600,
                        borderBottom: '1px solid var(--border-subtle)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {iface.name}
                    </td>
                    <td
                      style={{
                        padding: '6px 10px',
                        color: 'var(--text-accent)',
                        borderBottom: '1px solid var(--border-subtle)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {iface.type}
                    </td>
                    <td
                      style={{
                        padding: '6px 10px',
                        color: 'var(--text-secondary)',
                        borderBottom: '1px solid var(--border-subtle)',
                        fontFamily: 'inherit',
                        maxWidth: '200px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={iface.signature}
                    >
                      {iface.signature}
                    </td>
                    <td
                      style={{
                        padding: '6px 10px',
                        color: 'var(--text-secondary)',
                        borderBottom: '1px solid var(--border-subtle)',
                        maxWidth: '240px',
                      }}
                    >
                      {iface.description}
                    </td>
                    <td
                      style={{
                        padding: '6px 10px',
                        borderBottom: '1px solid var(--border-subtle)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <span
                        style={{ fontSize: '11px', color: 'var(--text-secondary)' }}
                      >
                        {iface.filePath}
                        {iface.lineStart ? `#L${iface.lineStart}` : ''}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Citations */}
      {subsystem.citations.length > 0 && (
        <section style={{ marginBottom: '24px' }}>
          <SectionLabel>Citations</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {subsystem.citations.map((c, i) => (
              <CodeCitation
                key={i}
                filePath={c.filePath}
                lineStart={c.lineStart}
                lineEnd={c.lineEnd}
                githubUrl={c.githubUrl}
                description={c.description}
              />
            ))}
          </div>
        </section>
      )}

      {/* Dependencies */}
      {subsystem.dependencies.length > 0 && (
        <section style={{ marginBottom: '24px' }}>
          <SectionLabel>Dependencies</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {subsystem.dependencies.map((dep) => (
              <button
                key={dep}
                onClick={() => onNavigate?.(dep)}
                style={{
                  backgroundColor: 'transparent',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-accent)',
                  fontFamily: 'inherit',
                  fontSize: '12px',
                  padding: '3px 10px',
                  cursor: onNavigate ? 'pointer' : 'default',
                  transition: 'border-color 0.15s ease',
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.borderColor = 'var(--accent)')
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.borderColor = 'var(--border-default)')
                }
              >
                {dep}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Key Files */}
      {subsystem.keyFiles.length > 0 && (
        <section style={{ marginBottom: '24px' }}>
          <SectionLabel>Key Files</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {subsystem.keyFiles.map((file) => (
              <div
                key={file}
                style={{
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                  fontFamily: 'inherit',
                  padding: '2px 0',
                }}
              >
                <span style={{ color: 'var(--text-muted)', marginRight: '6px' }}>
                  ▪
                </span>
                {file}
              </div>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
