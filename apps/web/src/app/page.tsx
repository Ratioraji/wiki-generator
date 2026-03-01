import { RepoInput } from '@/components/repo-input';
import { WikiHistory } from '@/components/wiki-history';

export default function Home() {
  return (
    <main
      style={{
        backgroundColor: 'var(--bg-primary)',
        minHeight: '100vh',
        padding: '20px',
        maxWidth: '1200px',
        margin: '0 auto',
      }}
    >
      {/* Header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
          paddingBottom: '16px',
          borderBottom: '1px solid var(--border-default)',
        }}
      >
        <h1
          style={{
            fontSize: '14px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--text-primary)',
            margin: 0,
          }}
        >
          Wiki Generator
        </h1>

        <a
          href="https://github.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: '11px',
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--text-secondary)',
            textDecoration: 'none',
            border: '1px solid var(--border-default)',
            padding: '4px 12px',
            transition: 'all 0.15s ease',
          }}
        >
          GitHub
        </a>
      </header>

      {/* Repo input form */}
      <section style={{ marginBottom: '32px' }}>
        <RepoInput />
      </section>

      {/* Wiki history */}
      <WikiHistory />
    </main>
  );
}
