interface CodeCitationProps {
  filePath: string;
  lineStart: number;
  lineEnd: number;
  githubUrl: string;
  description?: string;
}

export function CodeCitation({
  filePath,
  lineStart,
  lineEnd,
  githubUrl,
  description,
}: CodeCitationProps) {
  const label = `${filePath}#L${lineStart}${lineEnd !== lineStart ? `-L${lineEnd}` : ''} →`;

  return (
    <div style={{ marginBottom: '6px' }}>
      {description && (
        <span
          style={{
            fontSize: '12px',
            color: 'var(--text-secondary)',
            marginRight: '8px',
          }}
        >
          {description}
        </span>
      )}
      <a
        href={githubUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          fontSize: '12px',
          color: 'var(--text-accent)',
          fontFamily: 'inherit',
          textDecoration: 'none',
          transition: 'text-decoration 0.1s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
        onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
      >
        {label}
      </a>
    </div>
  );
}
