'use client';

import { useAuthContext } from '@/providers/auth-provider';

export function Header() {
  const { user, logout } = useAuthContext();

  if (!user) return null;

  return (
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
      <a
        href="/"
        style={{
          fontSize: '14px',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: 'var(--text-primary)',
          textDecoration: 'none',
        }}
      >
        Wiki Generator
      </a>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          {user.avatarUrl && (
            <img
              src={user.avatarUrl}
              alt={user.username}
              width={24}
              height={24}
              style={{
                borderRadius: '50%',
                border: '1px solid var(--border-default)',
              }}
            />
          )}
          <span
            style={{
              fontSize: '12px',
              color: 'var(--text-secondary)',
            }}
          >
            @{user.username}
          </span>
        </div>

        <button
          onClick={() => void logout()}
          style={{
            fontSize: '11px',
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--text-secondary)',
            backgroundColor: 'transparent',
            border: '1px solid var(--border-default)',
            borderRadius: '0px',
            padding: '4px 12px',
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent)';
            e.currentTarget.style.color = 'var(--text-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-default)';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }}
        >
          Logout
        </button>
      </div>
    </header>
  );
}
