'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuthContext } from '@/providers/auth-provider';

const PUBLIC_PATHS = ['/login'];

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated } = useAuthContext();
  const pathname = usePathname();
  const router = useRouter();

  const isPublic = PUBLIC_PATHS.includes(pathname);

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated && !isPublic) {
      router.replace('/login');
    }

    if (isAuthenticated && isPublic) {
      router.replace('/');
    }
  }, [isLoading, isAuthenticated, isPublic, router]);

  // Loading state
  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: 'var(--bg-primary)',
        }}
      >
        <span
          style={{
            fontSize: '12px',
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--text-secondary)',
          }}
        >
          Loading...
        </span>
      </div>
    );
  }

  // Not authenticated on protected route — don't render (redirect in useEffect)
  if (!isAuthenticated && !isPublic) {
    return null;
  }

  // Authenticated on public route — don't render (redirect in useEffect)
  if (isAuthenticated && isPublic) {
    return null;
  }

  return <>{children}</>;
}
