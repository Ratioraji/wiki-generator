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

// ── JSONB column shapes ───────────────────────────────────────────────────────

export interface InterfaceDoc {
  name: string;
  description: string;
  signature?: string;
  params?: Array<{ name: string; type: string; description?: string }>;
  returns?: string;
}

export interface Citation {
  filePath: string;
  lineNumber?: number;
  snippet?: string;
  context?: string;
}

// ─────────────────────────────────────────────────────────────────────────────

@Index('idx_wiki_subsystems_wiki_id', ['wikiId'])
@Entity('wiki_subsystems')
export class WikiSubsystem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'wiki_id', type: 'uuid' })
  wikiId: string;

  @ManyToOne('Wiki', 'subsystems', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'wiki_id' })
  wiki: Wiki;

  @Column({ name: 'group_id', type: 'varchar', length: 100 })
  groupId: string;

  @Column({ name: 'name', type: 'varchar', length: 200 })
  name: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'overview', type: 'text' })
  overview: string;

  @Column({ name: 'how_it_works', type: 'text', nullable: true })
  howItWorks: string | null;

  @Column({ name: 'public_interfaces', type: 'jsonb', nullable: true })
  publicInterfaces: InterfaceDoc[] | null;

  @Column({ name: 'citations', type: 'jsonb', nullable: true })
  citations: Citation[] | null;

  @Column({ name: 'dependencies', type: 'text', array: true, nullable: true })
  dependencies: string[] | null;

  @Column({ name: 'key_files', type: 'text', array: true, nullable: true })
  keyFiles: string[] | null;

  @Column({ name: 'display_order', type: 'int', default: 0 })
  displayOrder: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
