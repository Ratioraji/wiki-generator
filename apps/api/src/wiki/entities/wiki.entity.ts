import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { WikiStatus } from '../enums/wiki-status.enum';
import { User } from '../../auth/entities/user.entity';
import type { WikiSubsystem } from './wiki-subsystem.entity';
import type { WikiFileMap } from './wiki-file-map.entity';

@Index('idx_wikis_repo_branch_user_active', ['repoUrl', 'branch', 'userId'], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
@Entity('wikis')
export class Wiki {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'repo_url', type: 'varchar', length: 500 })
  repoUrl: string;

  @Column({ name: 'repo_name', type: 'varchar', length: 200 })
  repoName: string;

  @Column({ name: 'branch', type: 'varchar', length: 200 })
  branch: string;

  @Column({ name: 'repo_summary', type: 'text', nullable: true })
  repoSummary: string | null;

  @Column({
    name: 'status',
    type: 'varchar',
    length: 20,
    default: WikiStatus.PROCESSING,
  })
  status: WikiStatus;

  @Column({ name: 'total_files', type: 'int', nullable: true })
  totalFiles: number | null;

  @Column({ name: 'total_subsystems', type: 'int', nullable: true })
  totalSubsystems: number | null;

  @Column({
    name: 'processing_started_at',
    type: 'timestamptz',
    default: () => 'NOW()',
  })
  processingStartedAt: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany('WikiSubsystem', 'wiki', { cascade: true })
  subsystems: WikiSubsystem[];

  @OneToMany('WikiFileMap', 'wiki', { cascade: true })
  fileMaps: WikiFileMap[];
}
