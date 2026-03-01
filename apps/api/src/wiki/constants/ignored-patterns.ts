export const IGNORED_DIRECTORIES = [
  'node_modules', '.git', 'dist', 'build', '.next', '__pycache__',
  '.cache', 'coverage', '.nyc_output', 'vendor', '.venv', 'venv',
  '.idea', '.vscode', '.svn', 'tmp', 'temp', '.turbo',
];

export const IGNORED_FILES = [
  'package-lock.json', 'yarn.lock', 'bun.lockb', 'pnpm-lock.yaml',
  '.DS_Store', 'Thumbs.db', '.env', '.env.local', '.env.production',
];

export const IGNORED_EXTENSIONS = [
  '.min.js', '.min.css', '.map', '.lock',
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp',
  '.woff', '.woff2', '.ttf', '.eot',
  '.mp3', '.mp4', '.wav', '.avi',
  '.zip', '.tar', '.gz', '.rar',
  '.pdf', '.doc', '.docx',
  '.pyc', '.class', '.o', '.so', '.dll', '.exe',
];
