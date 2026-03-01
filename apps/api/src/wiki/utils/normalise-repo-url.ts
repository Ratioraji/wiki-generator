/**
 * Normalise a GitHub repo URL to a canonical form used for deduplication
 * and storage. Strips protocol, trailing .git, and trailing slashes.
 *
 * Examples:
 *   https://github.com/owner/repo.git → github.com/owner/repo
 *   https://github.com/owner/repo/   → github.com/owner/repo
 *   github.com/owner/repo            → github.com/owner/repo
 */
export function normaliseRepoUrl(url: string): string {
  return url
    .toLowerCase()
    .replace(/\.git$/, '')
    .replace(/\/+$/, '')
    .replace(/^https?:\/\//, '');
}

/**
 * Extract "owner/repo" from a normalised URL.
 *
 * Examples:
 *   github.com/owner/repo → owner/repo
 */
export function extractRepoName(normalisedUrl: string): string {
  const parts = normalisedUrl.split('/');
  return parts.slice(-2).join('/');
}
