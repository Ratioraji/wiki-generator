import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Param,
  Res,
  Header,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { User } from '../../auth/entities/user.entity';
import { GenerateWikiUseCase } from '../usecases/generate-wiki.usecase';
import { GetWikiUseCase } from '../usecases/get-wiki.usecase';
import { ListWikisUseCase } from '../usecases/list-wikis.usecase';
import { CheckExistingWikiUseCase } from '../usecases/check-existing-wiki.usecase';
import { AskQuestionUseCase } from '../usecases/ask-question.usecase';
import { GenerateWikiDto } from '../dto/generate-wiki.dto';
import { ListWikisDto } from '../dto/list-wikis.dto';
import { CheckExistingWikiDto } from '../dto/check-existing-wiki.dto';
import { AskQuestionDto } from '../dto/ask-question.dto';

@ApiTags('wiki')
@ApiBearerAuth()
@Controller('wiki')
@UseGuards(JwtAuthGuard)
export class WikiController {
  constructor(
    private readonly generateWikiUseCase: GenerateWikiUseCase,
    private readonly getWikiUseCase: GetWikiUseCase,
    private readonly listWikisUseCase: ListWikisUseCase,
    private readonly checkExistingWikiUseCase: CheckExistingWikiUseCase,
    private readonly askQuestionUseCase: AskQuestionUseCase,
  ) {}

  /**
   * POST /wiki/generate — SSE streaming endpoint.
   *
   * NestJS's @Sse() decorator is GET-only, so we use @Post() with @Res() and
   * manually write the SSE protocol to the response. The GenerateWikiUseCase
   * returns an Observable<SSEEvent> that is subscribed here and flushed as
   * `data: <json>\n\n` frames until the observable completes or errors.
   *
   * Clients should use fetch() with ReadableStream, not the browser EventSource
   * API (which does not support POST).
   */
  @Post('generate')
  @Header('Content-Type', 'text/event-stream')
  @Header('Cache-Control', 'no-cache')
  @Header('X-Accel-Buffering', 'no')
  @Header('Connection', 'keep-alive')
  @ApiOperation({ summary: 'Generate wiki from GitHub repository (SSE stream)' })
  @ApiResponse({ status: 201, description: 'SSE stream opened — events emitted until complete or error' })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  generate(@CurrentUser() user: User, @Body() dto: GenerateWikiDto, @Res() res: Response): void {
    res.flushHeaders();

    this.generateWikiUseCase.execute(dto, user.id).subscribe({
      next: (event) => res.write(`data: ${JSON.stringify(event)}\n\n`),
      complete: () => res.end(),
      error: () => res.end(),
    });
  }

  /** GET /wiki — paginated list of all wikis. */
  @Get()
  @ApiOperation({ summary: 'List all generated wikis' })
  @ApiResponse({ status: 200, description: 'Paginated list of wikis' })
  list(@CurrentUser() user: User, @Query() dto: ListWikisDto) {
    return this.listWikisUseCase.execute(dto, user.id);
  }

  /**
   * GET /wiki/check — existence check for a repo + branch pair.
   *
   * IMPORTANT: This route must be declared BEFORE @Get(':id') to prevent
   * Express from matching the literal path "check" as a dynamic :id segment.
   */
  @Get('check')
  @ApiOperation({ summary: 'Check if a wiki already exists for a given repo and branch' })
  @ApiResponse({ status: 200, description: 'Existence check result with optional wikiId and createdAt' })
  check(@CurrentUser() user: User, @Query() dto: CheckExistingWikiDto) {
    return this.checkExistingWikiUseCase.execute(dto, user.id);
  }

  /** GET /wiki/:id — full wiki with subsystems and file maps. */
  @Get(':id')
  @ApiOperation({ summary: 'Get full wiki by ID' })
  @ApiResponse({ status: 200, description: 'Full wiki content with subsystems and file maps' })
  @ApiResponse({ status: 404, description: 'Wiki not found' })
  findOne(@CurrentUser() user: User, @Param('id') id: string) {
    return this.getWikiUseCase.execute(id, user.id);
  }

  /** POST /wiki/:id/ask — RAG-based Q&A over a completed wiki. */
  @Post(':id/ask')
  @ApiOperation({ summary: 'Ask a question about a wiki using RAG' })
  @ApiResponse({ status: 200, description: 'Answer with subsystem and file citations' })
  @ApiResponse({ status: 400, description: 'Wiki is not yet complete' })
  @ApiResponse({ status: 404, description: 'Wiki not found' })
  ask(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: AskQuestionDto) {
    return this.askQuestionUseCase.execute({ wikiId: id, question: dto.question, userId: user.id });
  }
}
