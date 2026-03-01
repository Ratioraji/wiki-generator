'use client';

import { useRef, useState } from 'react';
import Markdown from 'react-markdown';
import { askQuestion } from '@/lib/api-client';
import type { QaResponse } from '@/types/wiki.types';
import type { ComponentProps } from 'react';

interface QaPanelProps {
  wikiId: string;
}

interface QaHistoryItem {
  question: string;
  answer: QaResponse;
}

const mdComponents: ComponentProps<typeof Markdown>['components'] = {
  p: ({ children }) => (
    <p style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.7, marginBottom: '10px' }}>
      {children}
    </p>
  ),
  code: ({ children }) => (
    <code style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-accent)', fontSize: '12px', padding: '2px 6px', fontFamily: 'inherit' }}>
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre style={{ backgroundColor: 'var(--bg-card-inner)', border: '1px solid var(--border-default)', padding: '10px 14px', fontSize: '12px', overflowX: 'auto', fontFamily: 'inherit', marginBottom: '10px' }}>
      {children}
    </pre>
  ),
  ul: ({ children }) => (
    <ul style={{ color: 'var(--text-primary)', fontSize: '13px', paddingLeft: '16px', marginBottom: '10px' }}>
      {children}
    </ul>
  ),
  li: ({ children }) => (
    <li style={{ marginBottom: '3px', lineHeight: 1.6 }}>{children}</li>
  ),
};

export function QaPanel({ wikiId }: QaPanelProps) {
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<QaHistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || isLoading) return;

    setIsLoading(true);
    setError(null);
    setQuestion('');

    try {
      const result = await askQuestion(wikiId, q);
      setHistory((prev) => [...prev, { question: q, answer: result }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get answer');
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }

  return (
    <div
      id="qa-panel"
      style={{
        borderTop: '1px solid var(--border-default)',
        backgroundColor: 'var(--bg-card)',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 20px',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <span
          style={{
            fontSize: '10px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            color: 'var(--text-secondary)',
          }}
        >
          Ask a Question
        </span>
      </div>

      {/* Q&A history */}
      {history.length > 0 && (
        <div
          style={{
            maxHeight: '400px',
            overflowY: 'auto',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          {history.map((item, i) => (
            <div key={i}>
              {/* Question */}
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--text-accent)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>→</span>
                <span>{item.question}</span>
              </div>

              {/* Answer */}
              <div style={{ paddingLeft: '16px', borderLeft: '2px solid var(--border-accent)' }}>
                <Markdown components={mdComponents}>{item.answer.answer}</Markdown>

                {/* Sources */}
                {item.answer.sources.length > 0 && (
                  <div style={{ marginTop: '10px' }}>
                    <div
                      style={{
                        fontSize: '10px',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        color: 'var(--text-secondary)',
                        marginBottom: '6px',
                      }}
                    >
                      Sources
                    </div>
                    {item.answer.sources.map((src, j) => (
                      <div
                        key={j}
                        style={{
                          display: 'flex',
                          alignItems: 'baseline',
                          gap: '8px',
                          marginBottom: '4px',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '11px',
                            color: 'var(--text-secondary)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            flexShrink: 0,
                          }}
                        >
                          {src.subsystem}
                        </span>
                        {src.filePath && (
                          <>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>·</span>
                            <span style={{ fontSize: '11px', color: 'var(--text-accent)' }}>
                              {src.filePath}
                              {src.lines ? `#L${src.lines}` : ''}
                            </span>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {i < history.length - 1 && (
                <div
                  style={{ height: '1px', backgroundColor: 'var(--border-subtle)', marginTop: '16px' }}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          style={{
            padding: '8px 20px',
            fontSize: '12px',
            color: '#8b3a3a',
            borderTop: '1px solid var(--border-subtle)',
          }}
        >
          ✗ {error}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div
          style={{
            padding: '12px 20px',
            fontSize: '12px',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            borderTop: '1px solid var(--border-subtle)',
          }}
          className="phase-active"
        >
          Processing...
        </div>
      )}

      {/* Input form */}
      <form
        onSubmit={handleSubmit}
        style={{
          display: 'flex',
          gap: '0',
          padding: '12px 20px',
          borderTop: '1px solid var(--border-subtle)',
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="How does the authentication system work?"
          disabled={isLoading}
          style={{
            flex: 1,
            backgroundColor: 'var(--bg-input)',
            border: '1px solid var(--border-default)',
            borderRight: 'none',
            color: 'var(--text-primary)',
            fontFamily: 'inherit',
            fontSize: '13px',
            padding: '10px 14px',
            outline: 'none',
            transition: 'border-color 0.15s ease',
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
          onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-default)')}
        />
        <button
          type="submit"
          disabled={!question.trim() || isLoading}
          style={{
            backgroundColor: question.trim() && !isLoading ? 'var(--accent)' : '#333333',
            color: question.trim() && !isLoading ? '#fff' : 'var(--text-muted)',
            border: 'none',
            fontFamily: 'inherit',
            fontSize: '12px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            padding: '10px 20px',
            cursor: question.trim() && !isLoading ? 'pointer' : 'not-allowed',
            transition: 'background-color 0.15s ease',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            if (question.trim() && !isLoading)
              e.currentTarget.style.backgroundColor = 'var(--accent-hover)';
          }}
          onMouseLeave={(e) => {
            if (question.trim() && !isLoading)
              e.currentTarget.style.backgroundColor = 'var(--accent)';
          }}
        >
          Ask
        </button>
      </form>
    </div>
  );
}
