import { Injectable, Logger } from '@nestjs/common';
import { execSync } from 'child_process';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, extname } from 'path';
import type { FileEntry, RepoStructure } from './file-parser.service';
import {
  IGNORED_DIRECTORIES,
  IGNORED_FILES,
  IGNORED_EXTENSIONS,
} from '../constants/ignored-patterns';

const README_MAX_CHARS = 2_000;
const FILE_MAX_BYTES = 500_000; // 500 KB — skip very large files

@Injectable()
export class RepoIngestionService {
  private readonly logger = new Logger(RepoIngestionService.name);

  // ── Public ───────────────────────────────────────────────────────────────────

  /**
   * Clone repo, walk file tree, and return structured file data.
   * Applies all ignore-list filters; never calls an LLM.
   */
  async ingest(
    repoUrl: string,
    branch: string,
    wikiId: string,
  ): Promise<RepoStructure> {
    const cloneDir = `/tmp/wiki-${wikiId}`;
    const cloneUrl = this.toHttpsUrl(repoUrl);

    this.logger.log(`Cloning ${cloneUrl}#${branch} → ${cloneDir}`);
    this.clone(cloneUrl, branch, cloneDir);

    const files: FileEntry[] = [];
    const treeLines: string[] = [];
    this.walk(cloneDir, cloneDir, files, treeLines, '');

    const readme = this.readReadme(cloneDir);

    this.logger.log(
      `Ingestion complete: ${files.length} files accepted`,
    );

    return {
      files,
      tree: treeLines.join('\n'),
      totalFiles: files.length,
      readme,
    };
  }

  /** Remove the cloned temp directory. */
  async cleanup(wikiId: string): Promise<void> {
    const cloneDir = `/tmp/wiki-${wikiId}`;
    try {
      execSync(`rm -rf "${cloneDir}"`, { stdio: 'pipe' });
      this.logger.log(`Cleaned up ${cloneDir}`);
    } catch (error) {
      this.logger.warn(
        `Cleanup failed for ${cloneDir}: ${(error as Error).message}`,
      );
    }
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  /**
   * Normalise any URL form to https://{host}/{path} — no .git suffix, no trailing slash.
   */
  private toHttpsUrl(repoUrl: string): string {
    const stripped = repoUrl
      .replace(/^https?:\/\//, '')
      .replace(/\.git$/, '')
      .replace(/\/+$/, '');
    return `https://${stripped}`;
  }

  /**
   * Shallow clone (depth 1) the given branch.
   * Throws a descriptive Error on failure.
   */
  private clone(cloneUrl: string, branch: string, cloneDir: string): void {
    try {
      execSync(
        `git clone --depth 1 --branch "${branch}" "${cloneUrl}" "${cloneDir}"`,
        { stdio: 'pipe', timeout: 120_000 },
      );
    } catch (error) {
      const stderr =
        (error as { stderr?: Buffer }).stderr?.toString().trim() ?? '';
      throw new Error(
        `Failed to clone ${cloneUrl} (branch=${branch}): ${stderr || (error as Error).message}`,
      );
    }
  }

  /**
   * Recursively walk the directory.
   * Populates `files` and `treeLines` in-place.
   */
  private walk(
    rootDir: string,
    currentDir: string,
    files: FileEntry[],
    treeLines: string[],
    indent: string,
  ): void {
    let entries: string[];
    try {
      entries = readdirSync(currentDir).sort();
    } catch {
      return; // unreadable directory — skip silently
    }

    for (const entry of entries) {
      const fullPath = join(currentDir, entry);

      let isDir = false;
      let fileSize = 0;
      try {
        const st = statSync(fullPath);
        isDir = st.isDirectory();
        fileSize = st.size;
      } catch {
        continue; // broken symlink or permission error
      }

      if (isDir) {
        if (IGNORED_DIRECTORIES.includes(entry)) continue;
        treeLines.push(`${indent}${entry}/`);
        this.walk(rootDir, fullPath, files, treeLines, `${indent}  `);
      } else {
        // ── File filtering ────────────────────────────────────────────────────
        if (IGNORED_FILES.includes(entry)) continue;

        // handles both simple (.png) and compound (.min.js) extensions
        if (IGNORED_EXTENSIONS.some((ignored) => entry.endsWith(ignored))) {
          continue;
        }

        if (fileSize > FILE_MAX_BYTES) {
          this.logger.debug(`Skipping oversized file: ${entry} (${fileSize} B)`);
          continue;
        }

        let content: string;
        try {
          content = readFileSync(fullPath, 'utf8');
        } catch {
          continue; // binary or unreadable — skip
        }

        treeLines.push(`${indent}${entry}`);

        const relativePath = relative(rootDir, fullPath);
        files.push({
          path: relativePath,
          content,
          extension: extname(entry).toLowerCase(),
          lineCount: content.split('\n').length,
          sizeBytes: fileSize,
        });
      }
    }
  }

  /**
   * Return README.md contents (up to README_MAX_CHARS), or null if absent.
   * Checks common filename variants case-by-case.
   */
  private readReadme(cloneDir: string): string | null {
    const candidates = ['README.md', 'readme.md', 'Readme.md', 'README.MD'];
    for (const name of candidates) {
      try {
        const content = readFileSync(join(cloneDir, name), 'utf8');
        return content.length > README_MAX_CHARS
          ? `${content.slice(0, README_MAX_CHARS)}\n... (truncated)`
          : content;
      } catch {
        // not present — try next candidate
      }
    }
    return null;
  }
}
