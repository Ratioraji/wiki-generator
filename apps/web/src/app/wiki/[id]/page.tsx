'use client';

import { use } from 'react';
import { useWikiData } from '@/hooks/use-wiki-data';
import { WikiViewer } from '@/components/wiki-viewer';

interface WikiPageProps {
  params: Promise<{ id: string }>;
}

function SkeletonBlock({
  width = '100%',
  height = '16px',
}: {
  width?: string;
  height?: string;
}) {
  return (
    <div
      style={{
        width,
        height,
        backgroundColor: 'var(--bg-card-inner)',
        animation: 'phase-pulse 1.5s ease-in-out infinite',
      }}
    />
  );
}

function LoadingSkeleton() {
  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        backgroundColor: 'var(--bg-primary)',
      }}
    >
      {/* Sidebar skeleton */}
      <div
        style={{
          width: '250px',
          flexShrink: 0,
          backgroundColor: 'var(--bg-card)',
          borderRight: '1px solid var(--border-default)',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <SkeletonBlock height="20px" width="70%" />
        <SkeletonBlock height="12px" width="40%" />
        <div style={{ height: '1px', backgroundColor: 'var(--border-subtle)' }} />
        {[80, 60, 90, 55, 75].map((w, i) => (
          <SkeletonBlock key={i} height="14px" width={`${w}%`} />
        ))}
      </div>

      {/* Content skeleton */}
      <div
        style={{
          flex: 1,
          padding: '24px 32px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          maxWidth: '800px',
        }}
      >
        <SkeletonBlock height="24px" width="60%" />
        <SkeletonBlock height="14px" width="90%" />
        <SkeletonBlock height="14px" width="80%" />
        <SkeletonBlock height="14px" width="85%" />
        <div style={{ marginTop: '8px' }}>
          <SkeletonBlock height="14px" width="70%" />
        </div>
        {[95, 88, 76, 92, 65].map((w, i) => (
          <SkeletonBlock key={i} height="13px" width={`${w}%`} />
        ))}
      </div>
    </div>
  );
}

function WikiPageContent({ id }: { id: string }) {
  const { data: wiki, isLoading, isError, error } = useWikiData(id);

  if (isLoading) return <LoadingSkeleton />;

  if (isError || !wiki) {
    const is404 =
      error instanceof Error && error.message.includes('404');

    return (
      <div
        style={{
          backgroundColor: 'var(--bg-primary)',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
        }}
      >
        <div
          style={{
            fontSize: '28px',
            fontWeight: 700,
            color: 'var(--text-muted)',
          }}
        >
          {is404 ? '404' : '✗'}
        </div>
        <div
          style={{
            fontSize: '12px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--text-muted)',
          }}
        >
          {is404 ? 'Wiki not found' : 'Failed to load wiki'}
        </div>
        <a
          href="/"
          style={{
            marginTop: '8px',
            fontSize: '11px',
            color: 'var(--text-accent)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            textDecoration: 'none',
          }}
        >
          ← Back to Home
        </a>
      </div>
    );
  }

  if (wiki.status === 'failed') {
    return (
      <div
        style={{
          backgroundColor: 'var(--bg-primary)',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
        }}
      >
        <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-muted)' }}>✗</div>
        <div
          style={{
            fontSize: '12px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--text-muted)',
          }}
        >
          Wiki generation failed
        </div>
        <a
          href="/"
          style={{
            marginTop: '8px',
            fontSize: '11px',
            color: 'var(--text-accent)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            textDecoration: 'none',
          }}
        >
          ← Try Again
        </a>
      </div>
    );
  }

  return <WikiViewer wiki={wiki} />;
}

export default function WikiPage({ params }: WikiPageProps) {
  const { id } = use(params);
  return <WikiPageContent id={id} />;
}
