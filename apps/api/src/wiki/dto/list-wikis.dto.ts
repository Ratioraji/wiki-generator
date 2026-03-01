import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class ListWikisDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter wikis by repository name',
    example: 'my-repo',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
