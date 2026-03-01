import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsUrl } from 'class-validator';

export class GenerateWikiDto {
  @ApiProperty({
    description: 'Public GitHub repository URL',
    example: 'https://github.com/owner/repo',
  })
  @IsString()
  @IsUrl()
  repoUrl: string;

  @ApiPropertyOptional({
    description: 'Branch to generate wiki for',
    default: 'main',
  })
  @IsString()
  branch: string = 'main';

  @ApiPropertyOptional({
    description: 'Force regeneration even if wiki already exists',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  forceRegenerate?: boolean = false;
}
