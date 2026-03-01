import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import type { Wiki } from './wiki.entity';

// ── JSONB column shape ────────────────────────────────────────────────────────

export interface FunctionSummary {
  name: string;
  summary: string;
  params?: Array<{ name: string; type?: string; description?: string }>;
  returns?: string;
  isExported?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────

@Index('idx_wiki_file_maps_wiki_id', ['wikiId'])
@Entity('wiki_file_maps')
export class WikiFileMap {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'wiki_id', type: 'uuid' })
  wikiId: string;

  @ManyToOne('Wiki', 'fileMaps', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'wiki_id' })
  wiki: Wiki;

  @Column({ name: 'file_path', type: 'varchar', length: 500 })
  filePath: string;

  @Column({ name: 'group_id', type: 'varchar', length: 100 })
  groupId: string;

  @Column({ name: 'summary', type: 'text', nullable: true })
  summary: string | null;

  @Column({ name: 'function_summaries', type: 'jsonb', nullable: true })
  functionSummaries: FunctionSummary[] | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
