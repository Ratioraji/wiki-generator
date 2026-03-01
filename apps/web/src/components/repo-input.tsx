'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { checkExistingWiki } from '@/lib/api-client';
import type { CheckExistingResponse } from '@/types/wiki.types';
import { formatDistanceToNow } from 'date-fns';

export function RepoInput() {
  const router = useRouter();

  const [repoUrl, setRepoUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [forceRegenerate, setForceRegenerate] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [existing, setExisting] = useState<CheckExistingResponse | null>(null);
  const [checking, setChecking] = useState(false);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Validate GitHub URL format
  function isValidUrl(url: string) {
    try {
      const u = new URL(url);
      return (
        (u.protocol === 'https:' || u.protocol === 'http:') &&
        u.hostname !== ''
      );
    } catch {
      return false;
    }
  }

  // Debounced existence check — fires 300ms after URL or branch changes
  const scheduleCheck = useCallback((url: string, br: string) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    setExisting(null);

    if (!url || !br || !isValidUrl(url)) return;

    debounceTimer.current = setTimeout(async () => {
      setChecking(true);
      try {
        const result = await checkExistingWiki(url, br);
        setExisting(result);
      } catch {
        setExisting(null);
      } finally {
        setChecking(false);
      }
    }, 300);
  }, []);

  useEffect(() => {
    scheduleCheck(repoUrl, branch);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [repoUrl, branch, scheduleCheck]);

  function handleUrlChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setRepoUrl(v);
    if (v && !isValidUrl(v)) {
      setUrlError('Enter a valid URL (https://github.com/org/repo)');
    } else {
      setUrlError(null);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!repoUrl || urlError) return;

    // Existing wiki found and not forcing regenerate — navigate directly
    if (existing?.exists && !forceRegenerate && existing.wikiId) {
      router.push(`/wiki/${existing.wikiId}`);
      return;
    }

    const params = new URLSearchParams({ repo: repoUrl, branch });
    if (forceRegenerate) params.set('force', 'true');
    router.push(`/wiki/processing?${params}`);
  }

  const hasExisting = existing?.exists && !forceRegenerate;
  const buttonLabel = hasExisting ? 'VIEW EXISTING WIKI' : 'GENERATE WIKI';
  const isSubmittable = Boolean(repoUrl && !urlError && branch);

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-default)',
        padding: '20px',
      }}
    >
      {/* Repository URL */}
      <div style={{ marginBottom: '16px' }}>
        <label
          htmlFor="repo-url"
          style={{
            display: 'block',
            fontSize: '10px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            color: 'var(--text-secondary)',
            marginBottom: '6px',
          }}
        >
          Repository URL
        </label>
        <input
          id="repo-url"
          type="text"
          value={repoUrl}
          onChange={handleUrlChange}
          placeholder="https://github.com/org/repo"
          autoComplete="off"
          style={{
            width: '100%',
            backgroundColor: 'var(--bg-input)',
            border: `1px solid ${urlError ? '#8b3a3a' : 'var(--border-default)'}`,
            color: 'var(--text-primary)',
            fontFamily: 'inherit',
            fontSize: '13px',
            padding: '10px 14px',
            outline: 'none',
            transition: 'border-color 0.15s ease',
            boxSizing: 'border-box',
          }}
          onFocus={(e) =>
            (e.currentTarget.style.borderColor = urlError
              ? '#8b3a3a'
              : 'var(--accent)')
          }
          onBlur={(e) =>
            (e.currentTarget.style.borderColor = urlError
              ? '#8b3a3a'
              : 'var(--border-default)')
          }
        />
        {urlError && (
          <p
            style={{
              fontSize: '11px',
              color: '#8b3a3a',
              marginTop: '4px',
              letterSpacing: '0.04em',
            }}
          >
            {urlError}
          </p>
        )}
      </div>

      {/* Branch + Force regenerate row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '16px',
          marginBottom: '16px',
          flexWrap: 'wrap',
        }}
      >
        {/* Branch input */}
        <div style={{ flex: '0 0 180px' }}>
          <label
            htmlFor="branch"
            style={{
              display: 'block',
              fontSize: '10px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              color: 'var(--text-secondary)',
              marginBottom: '6px',
            }}
          >
            Branch
          </label>
          <input
            id="branch"
            type="text"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            placeholder="main"
            style={{
              width: '100%',
              backgroundColor: 'var(--bg-input)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-primary)',
              fontFamily: 'inherit',
              fontSize: '13px',
              padding: '10px 14px',
              outline: 'none',
              transition: 'border-color 0.15s ease',
              boxSizing: 'border-box',
            }}
            onFocus={(e) =>
              (e.currentTarget.style.borderColor = 'var(--accent)')
            }
            onBlur={(e) =>
              (e.currentTarget.style.borderColor = 'var(--border-default)')
            }
          />
        </div>

        {/* Force regenerate checkbox */}
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            paddingBottom: '10px',
          }}
        >
          <input
            type="checkbox"
            checked={forceRegenerate}
            onChange={(e) => setForceRegenerate(e.target.checked)}
            style={{
              width: '14px',
              height: '14px',
              accentColor: 'var(--accent)',
              cursor: 'pointer',
            }}
          />
          <span
            style={{
              fontSize: '11px',
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--text-secondary)',
            }}
          >
            Force Regenerate
          </span>
        </label>

        {/* Submit button — pushed to the right */}
        <div style={{ marginLeft: 'auto', paddingBottom: '0' }}>
          <button
            type="submit"
            disabled={!isSubmittable}
            style={{
              backgroundColor: isSubmittable ? 'var(--accent)' : '#333333',
              color: isSubmittable ? '#fff' : 'var(--text-muted)',
              border: 'none',
              fontFamily: 'inherit',
              fontSize: '12px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              padding: '10px 24px',
              cursor: isSubmittable ? 'pointer' : 'not-allowed',
              transition: 'background-color 0.15s ease',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              if (isSubmittable)
                e.currentTarget.style.backgroundColor = 'var(--accent-hover)';
            }}
            onMouseLeave={(e) => {
              if (isSubmittable)
                e.currentTarget.style.backgroundColor = 'var(--accent)';
            }}
          >
            {checking ? '...' : buttonLabel}
          </button>
        </div>
      </div>

      {/* Existing wiki info banner */}
      {existing?.exists && existing.createdAt && (
        <div
          style={{
            backgroundColor: 'var(--accent-muted)',
            border: '1px solid var(--border-accent)',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span style={{ color: 'var(--text-accent)', fontSize: '12px' }}>
            ▪
          </span>
          <span
            style={{
              fontSize: '11px',
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Wiki exists — generated{' '}
            <span style={{ color: 'var(--text-accent)' }}>
              {formatDistanceToNow(new Date(existing.createdAt), {
                addSuffix: true,
              })}
            </span>
            . Check &ldquo;Force Regenerate&rdquo; to overwrite.
          </span>
        </div>
      )}
    </form>
  );
}
