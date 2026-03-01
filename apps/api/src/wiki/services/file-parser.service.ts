import { Injectable } from '@nestjs/common';
import type { ParsedFile, StructureRef } from '../interfaces/file-classification.interface';

// ── Shared types (imported by RepoIngestionService) ───────────────────────────

export interface FileEntry {
  path: string;     // relative to repo root
  content: string;
  extension: string;
  lineCount: number;
  sizeBytes: number;
}

export interface RepoStructure {
  files: FileEntry[];
  tree: string;       // visual file tree for LLM context
  totalFiles: number;
  readme: string | null;
}

// ── Regex patterns (from agent spec) ─────────────────────────────────────────

// TypeScript / JavaScript
const TS_FUNCTION   = /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/gm;
const TS_CLASS      = /^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/gm;
const TS_ARROW      = /^export\s+const\s+(\w+)\s*=\s*(?:async\s+)?\(/gm;
const TS_METHOD     = /^\s{2,}(?:async\s+)?(\w+)\s*\([^)]*\)\s*[:{]/gm;

// Python
const PY_FUNCTION   = /^def\s+(\w+)\s*\(/gm;
const PY_CLASS      = /^class\s+(\w+)/gm;

// Generic (Go, Rust, Java, Kotlin, Swift, C#, PHP …)
const GEN_FUNCTION  = /^(?:pub\s+)?(?:async\s+)?(?:func|fn|def|function)\s+(\w+)\s*[(<]/gm;
const GEN_CLASS     = /^(?:public\s+|private\s+|abstract\s+|sealed\s+)?(?:class|struct|interface|enum)\s+(\w+)/gm;

// Words that look like function calls / control flow — never structure names
const CONTROL_FLOW = new Set([
  'if', 'for', 'while', 'switch', 'catch', 'return', 'typeof', 'instanceof',
  'new', 'delete', 'void', 'throw', 'try', 'case', 'default', 'break',
  'continue', 'yield', 'await', 'import', 'export', 'from',
]);

// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class FileParserService {
  /**
   * Parse a list of files and extract snippets + structural references.
   * Line numbers come ONLY from regex match positions — never from an LLM.
   */
  parse(files: FileEntry[]): ParsedFile[] {
    return files.map((file) => ({
      path: file.path,
      content: file.content,
      snippet: extractSnippet(file.content),
      lineCount: file.lineCount,
      extension: file.extension,
      structures: this.extractStructures(file.content, file.extension),
    }));
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private extractStructures(content: string, extension: string): StructureRef[] {
    const offsets = buildLineOffsets(content);
    const ext = extension.toLowerCase();

    if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
      return extractWithPatterns(content, offsets, [
        [copyRegex(TS_FUNCTION), 'function'],
        [copyRegex(TS_CLASS),    'class'],
        [copyRegex(TS_ARROW),    'export'],
        [copyRegex(TS_METHOD),   'function'],
      ]);
    }

    if (ext === '.py') {
      const lines = content.split('\n');
      return extractPython(content, offsets, lines);
    }

    return extractWithPatterns(content, offsets, [
      [copyRegex(GEN_FUNCTION), 'function'],
      [copyRegex(GEN_CLASS),    'class'],
    ]);
  }
}

// ── Extraction helpers ────────────────────────────────────────────────────────

type PatternEntry = [RegExp, StructureRef['type']];

function extractWithPatterns(
  content: string,
  offsets: number[],
  patterns: PatternEntry[],
): StructureRef[] {
  const refs: StructureRef[] = [];

  for (const [regex, type] of patterns) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      const name = match[1];
      if (!name || CONTROL_FLOW.has(name)) continue;

      const lineStart = charToLine(offsets, match.index);
      const lineEnd   = findBraceBlockEnd(content, offsets, match.index);
      refs.push({ name, type, lineStart, lineEnd });
    }
  }

  return deduplicateAndSort(refs);
}

function extractPython(
  content: string,
  offsets: number[],
  lines: string[],
): StructureRef[] {
  const refs: StructureRef[] = [];

  const patterns: PatternEntry[] = [
    [copyRegex(PY_FUNCTION), 'function'],
    [copyRegex(PY_CLASS),    'class'],
  ];

  for (const [regex, type] of patterns) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      const name = match[1];
      if (!name) continue;

      const lineStart = charToLine(offsets, match.index);
      const lineEnd   = findPythonBlockEnd(lines, lineStart - 1); // 0-based index
      refs.push({ name, type, lineStart, lineEnd });
    }
  }

  return deduplicateAndSort(refs);
}

// ── Line number utilities ─────────────────────────────────────────────────────

/**
 * Build an array where offsets[i] = char index of the first char on line i+1.
 * O(n) once per file — subsequent lookups are O(log n).
 */
function buildLineOffsets(content: string): number[] {
  const offsets = [0];
  for (let i = 0; i < content.length; i++) {
    if (content[i] === '\n') offsets.push(i + 1);
  }
  return offsets;
}

/** Binary-search charIndex → 1-based line number. */
function charToLine(offsets: number[], charIndex: number): number {
  let lo = 0;
  let hi = offsets.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (offsets[mid] <= charIndex) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

/**
 * For brace-delimited languages: find the closing `}` that matches the first
 * `{` at or after startPos, return its 1-based line number.
 */
function findBraceBlockEnd(
  content: string,
  offsets: number[],
  startPos: number,
): number {
  const openPos = content.indexOf('{', startPos);
  if (openPos === -1) return charToLine(offsets, startPos);

  let depth = 0;
  for (let i = openPos; i < content.length; i++) {
    if (content[i] === '{') depth++;
    else if (content[i] === '}') {
      depth--;
      if (depth === 0) return charToLine(offsets, i);
    }
  }

  return charToLine(offsets, content.length - 1);
}

/**
 * For Python: advance past all lines whose indent is greater than the
 * definition line's indent. Returns the 1-based number of the last content line.
 */
function findPythonBlockEnd(lines: string[], defLineIdx: number): number {
  const defLine    = lines[defLineIdx] ?? '';
  const baseIndent = defLine.length - defLine.trimStart().length;

  let lastContent = defLineIdx;

  for (let i = defLineIdx + 1; i < lines.length; i++) {
    const line    = lines[i];
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue; // blank / comment

    const indent = line.length - line.trimStart().length;
    if (indent <= baseIndent) break; // back to same or outer scope

    lastContent = i;
  }

  return lastContent + 1; // convert 0-based index → 1-based line number
}

// ── Misc helpers ──────────────────────────────────────────────────────────────

/** Snippet = first 40 lines (captures imports + top-level declarations). */
function extractSnippet(content: string): string {
  const newline = content.indexOf('\n', 0);
  if (newline === -1) return content;

  let pos = 0;
  for (let line = 0; line < 40; line++) {
    const next = content.indexOf('\n', pos);
    if (next === -1) return content;
    pos = next + 1;
  }
  return content.slice(0, pos);
}

/** Clone a regex so each parse call gets a fresh lastIndex. */
function copyRegex(r: RegExp): RegExp {
  return new RegExp(r.source, r.flags);
}

/** Remove duplicate (lineStart, name) pairs; sort ascending by lineStart. */
function deduplicateAndSort(refs: StructureRef[]): StructureRef[] {
  const seen = new Set<string>();
  return refs
    .filter((r) => {
      const key = `${r.lineStart}:${r.name}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.lineStart - b.lineStart);
}
