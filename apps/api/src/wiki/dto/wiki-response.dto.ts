import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { WikiStatus } from '../enums/wiki-status.enum';
import type { InterfaceDoc, Citation } from '../interfaces/wiki-content.interface';
import type { FunctionSummary } from '../entities/wiki-file-map.entity';

// ── Nested: subsystem ─────────────────────────────────────────────────────────

export class WikiSubsystemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  groupId: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional({ nullable: true })
  description: string | null;

  @ApiProperty()
  overview: string;

  @ApiPropertyOptional({ nullable: true })
  howItWorks: string | null;

  @ApiPropertyOptional({ type: 'array', items: { type: 'object' }, nullable: true })
  publicInterfaces: InterfaceDoc[] | null;

  @ApiPropertyOptional({ type: 'array', items: { type: 'object' }, nullable: true })
  citations: Citation[] | null;

  @ApiPropertyOptional({ type: [String], nullable: true })
  dependencies: string[] | null;

  @ApiPropertyOptional({ type: [String], nullable: true })
  keyFiles: string[] | null;

  @ApiProperty()
  displayOrder: number;

  @ApiProperty()
  createdAt: Date;
}

// ── Nested: file map ──────────────────────────────────────────────────────────

export class WikiFileMapDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  filePath: string;

  @ApiProperty()
  groupId: string;

  @ApiPropertyOptional({ nullable: true })
  summary: string | null;

  @ApiPropertyOptional({ type: 'array', items: { type: 'object' }, nullable: true })
  functionSummaries: FunctionSummary[] | null;

  @ApiProperty()
  createdAt: Date;
}

// ── Root response ─────────────────────────────────────────────────────────────

export class WikiResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  repoUrl: string;

  @ApiProperty()
  repoName: string;

  @ApiProperty()
  branch: string;

  @ApiPropertyOptional({ nullable: true })
  repoSummary: string | null;

  @ApiProperty({ description: 'processing | complete | failed' })
  status: WikiStatus;

  @ApiPropertyOptional({ nullable: true })
  totalFiles: number | null;

  @ApiPropertyOptional({ nullable: true })
  totalSubsystems: number | null;

  @ApiProperty({ type: () => WikiSubsystemDto, isArray: true })
  subsystems: WikiSubsystemDto[];

  @ApiProperty({ type: () => WikiFileMapDto, isArray: true })
  fileMaps: WikiFileMapDto[];

  @ApiPropertyOptional({ nullable: true })
  completedAt: Date | null;

  @ApiProperty()
  createdAt: Date;
}
