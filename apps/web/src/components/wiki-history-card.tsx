'use client';

import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import type { WikiListItem } from '@/types/wiki.types';

interface WikiHistoryCardProps {
  wiki: WikiListItem;
}

function StatusIndicator({ status }: { status: WikiListItem['status'] }) {
  if (status === 'complete') {
    return (
      <span
        style={{
          fontSize: '12px',
          color: 'var(--accent)',
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
        }}
      >
        <span>●</span>
        <span
          style={{
            fontSize: '10px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          Complete
        </span>
      </span>
    );
  }

  if (status === 'processing') {
    return (
      <span
        style={{
          fontSize: '12px',
          color: 'var(--accent)',
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
        }}
        className="phase-active"
      >
        <span>◷</span>
        <span
          style={{
            fontSize: '10px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          Processing
        </span>
      </span>
    );
  }

  return (
    <span
      style={{
        fontSize: '12px',
        color: 'var(--status-failed)',
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
      }}
    >
      <span>✗</span>
      <span
        style={{
          fontSize: '10px',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
        }}
      >
        Failed
      </span>
    </span>
  );
}

export function WikiHistoryCard({ wiki }: WikiHistoryCardProps) {
  const router = useRouter();

  function handleClick() {
    if (wiki.status === 'complete') {
      router.push(`/wiki/${wiki.id}`);
    } else if (wiki.status === 'processing') {
      const params = new URLSearchParams({
        repo: wiki.repoUrl,
        branch: wiki.branch,
      });
      router.push(`/wiki/processing?${params}`);
    } else {
      // Failed — navigate home with fields pre-filled via query params
      const params = new URLSearchParams({
        repo: wiki.repoUrl,
        branch: wiki.branch,
      });
      router.push(`/?${params}`);
    }
  }

  const timestamp = wiki.completedAt ?? wiki.createdAt;

  return (
    <div
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-default)',
        padding: '16px',
        cursor: 'pointer',
        transition: 'border-color 0.15s ease, background-color 0.1s ease',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        outline: 'none',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-accent)';
        e.currentTarget.style.backgroundColor = 'var(--bg-elevated)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-default)';
        e.currentTarget.style.backgroundColor = 'var(--bg-card)';
      }}
    >
      {/* Repo name */}
      <div
        style={{
          fontSize: '13px',
          fontWeight: 600,
          color: 'var(--text-primary)',
          wordBreak: 'break-all',
        }}
      >
        {wiki.repoName}
      </div>

      {/* Branch badge + status row */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}
      >
        {/* Branch badge */}
        <span
          style={{
            backgroundColor: 'var(--accent-muted)',
            border: '1px solid var(--border-accent)',
            color: 'var(--text-accent)',
            fontSize: '11px',
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            padding: '2px 8px',
          }}
        >
          {wiki.branch}
        </span>

        <StatusIndicator status={wiki.status} />
      </div>

      {/* Stats row (complete only) */}
      {wiki.status === 'complete' && wiki.totalSubsystems !== null && (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
          <span
            style={{
              fontSize: '20px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              lineHeight: 1,
            }}
          >
            {wiki.totalSubsystems}
          </span>
          <span
            style={{
              fontSize: '10px',
              fontWeight: 400,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              color: 'var(--text-secondary)',
            }}
          >
            subsystems
          </span>
          {wiki.totalFiles !== null && (
            <>
              <span
                style={{
                  fontSize: '10px',
                  color: 'var(--border-default)',
                  margin: '0 4px',
                }}
              >
                ·
              </span>
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                }}
              >
                {wiki.totalFiles}
              </span>
              <span
                style={{
                  fontSize: '10px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  color: 'var(--text-secondary)',
                }}
              >
                files
              </span>
            </>
          )}
        </div>
      )}

      {/* Summary snippet */}
      {wiki.status === 'complete' && wiki.repoSummary && (
        <p
          style={{
            fontSize: '12px',
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            margin: 0,
          }}
        >
          {wiki.repoSummary.slice(0, 120)}
          {wiki.repoSummary.length > 120 ? '…' : ''}
        </p>
      )}

      {/* Timestamp */}
      <div
        style={{
          fontSize: '11px',
          fontWeight: 400,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--text-muted)',
          marginTop: 'auto',
        }}
      >
        {formatDistanceToNow(new Date(timestamp), { addSuffix: true })}
      </div>
    </div>
  );
}
