'use client';

import { use } from 'react';
import Link from 'next/link';
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

function PageHeader({ repoName }: { repoName?: string }) {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 16px',
        borderBottom: '1px solid var(--border-default)',
        backgroundColor: 'var(--bg-primary)',
        flexShrink: 0,
      }}
    >
      <Link
        href="/"
        style={{
          fontSize: '12px',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: 'var(--text-primary)',
          textDecoration: 'none',
        }}
      >
        Wiki Generator
      </Link>
      {repoName && (
        <span
          style={{
            fontSize: '11px',
            color: 'var(--text-muted)',
            letterSpacing: '0.05em',
          }}
        >
          {repoName}
        </span>
      )}
    </header>
  );
}

function LoadingSkeleton() {
  return (
    <div
      style={{
        display: 'flex',
        flex: 1,
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

function CenteredMessage({ icon, message, linkText }: {
  icon: string;
  message: string;
  linkText: string;
}) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        backgroundColor: 'var(--bg-primary)',
      }}
    >
      <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-muted)' }}>{icon}</div>
      <div
        style={{
          fontSize: '12px',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: 'var(--text-muted)',
        }}
      >
        {message}
      </div>
      <Link
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
        {linkText}
      </Link>
    </div>
  );
}

function WikiPageContent({ id }: { id: string }) {
  const { data: wiki, isLoading, isError, error } = useWikiData(id);

  const is404 = isError && error instanceof Error && error.message.includes('404');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <PageHeader repoName={wiki?.repoName} />

      {isLoading ? (
        <LoadingSkeleton />
      ) : isError || !wiki ? (
        <CenteredMessage
          icon={is404 ? '404' : '✗'}
          message={is404 ? 'Wiki not found' : 'Failed to load wiki'}
          linkText="← Back to Home"
        />
      ) : wiki.status === 'failed' ? (
        <CenteredMessage icon="✗" message="Wiki generation failed" linkText="← Try Again" />
      ) : (
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <WikiViewer wiki={wiki} />
        </div>
      )}
    </div>
  );
}

export default function WikiPage({ params }: WikiPageProps) {
  const { id } = use(params);
  return <WikiPageContent id={id} />;
}
