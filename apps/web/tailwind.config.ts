import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    // Override ALL border-radius to zero — hard edges everywhere, no rounding
    borderRadius: {
      DEFAULT: '0px',
      none: '0px',
      sm: '0px',
      md: '0px',
      lg: '0px',
      xl: '0px',
      '2xl': '0px',
      '3xl': '0px',
      full: '0px',
    },
    extend: {
      colors: {
        // Accent — burnt orange / copper (the ONE accent colour)
        accent: '#c4652a',
        'accent-hover': '#d4753a',
        'accent-muted': 'rgba(196, 101, 42, 0.15)',

        // Backgrounds
        'bg-primary': '#1a1a1a',
        'bg-card': '#242424',
        'bg-card-inner': '#1e1e1e',
        'bg-elevated': '#2a2a2a',
        'bg-input': '#1e1e1e',

        // Borders
        'border-default': '#333333',
        'border-subtle': '#2a2a2a',
        'border-accent': '#c4652a',

        // Text
        'text-primary': '#e8e8e8',
        'text-secondary': '#888888',
        'text-muted': '#555555',
        'text-accent': '#c4652a',

        // Status
        'status-complete': '#c4652a',
        'status-processing': '#c4652a',
        'status-failed': '#8b3a3a',
        'status-pending': '#555555',
      },
      fontFamily: {
        // Everything is monospaced — no sans-serif anywhere
        mono: ['"JetBrains Mono"', '"Fira Code"', '"SF Mono"', 'monospace'],
        sans: ['"JetBrains Mono"', '"Fira Code"', '"SF Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
