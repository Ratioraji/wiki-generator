import { RepoInput } from '@/components/repo-input';
import { WikiHistory } from '@/components/wiki-history';
import { Header } from '@/components/header';

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
      <Header />

      {/* Repo input form */}
      <section style={{ marginBottom: '32px' }}>
        <RepoInput />
      </section>

      {/* Wiki history */}
      <WikiHistory />
    </main>
  );
}
