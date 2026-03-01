import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class AskQuestionDto {
  @ApiProperty({
    description: 'Question to ask about the wiki content',
    minLength: 3,
    example: 'How does the authentication system work?',
  })
  @IsString()
  @MinLength(3)
  question: string;
}
