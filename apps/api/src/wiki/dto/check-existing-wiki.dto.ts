import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CheckExistingWikiDto {
  @ApiProperty({
    description: 'GitHub repository URL',
    example: 'https://github.com/owner/repo',
  })
  @IsString()
  repoUrl: string;

  @ApiPropertyOptional({
    description: 'Branch to check',
    default: 'main',
  })
  @IsString()
  branch: string = 'main';
}
