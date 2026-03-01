import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CheckExistingResponseDto {
  @ApiProperty({ description: 'Whether a wiki already exists for this repo + branch' })
  exists: boolean;

  @ApiPropertyOptional({ description: 'ID of the existing wiki (present when exists is true)' })
  wikiId?: string;

  @ApiPropertyOptional({ description: 'When the wiki was created (present on DB hit)' })
  createdAt?: Date;
}
