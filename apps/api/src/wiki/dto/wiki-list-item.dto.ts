import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { WikiStatus } from '../enums/wiki-status.enum';

/**
 * Lightweight wiki representation returned by the list endpoint.
 * Does NOT include subsystems or file maps — use GET /wiki/:id for the full wiki.
 */
export class WikiListItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  repoUrl: string;

  @ApiProperty()
  repoName: string;

  @ApiProperty()
  branch: string;

  @ApiProperty({ description: 'processing | complete | failed' })
  status: WikiStatus;

  @ApiPropertyOptional({ nullable: true })
  totalSubsystems: number | null;

  @ApiPropertyOptional({ nullable: true })
  totalFiles: number | null;

  /** First 150 characters of the repo summary, or null if not yet generated. */
  @ApiPropertyOptional({ nullable: true })
  repoSummary: string | null;

  @ApiPropertyOptional({ nullable: true })
  completedAt: Date | null;

  @ApiProperty()
  createdAt: Date;
}
