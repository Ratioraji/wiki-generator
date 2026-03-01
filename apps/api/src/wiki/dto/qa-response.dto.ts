import { ApiProperty } from '@nestjs/swagger';

export class QaSourceDto {
  @ApiProperty({ description: 'Subsystem name the source belongs to' })
  subsystem: string;

  @ApiProperty({ description: 'File path of the source' })
  filePath: string;

  @ApiProperty({ description: 'Line range (e.g. "12-34")', nullable: true })
  lines: string | null;
}

export class QaResponseDto {
  @ApiProperty({ description: 'Answer to the question' })
  answer: string;

  @ApiProperty({ type: () => QaSourceDto, isArray: true })
  sources: QaSourceDto[];
}
