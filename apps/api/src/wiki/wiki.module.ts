import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';

import { Wiki } from './entities/wiki.entity';
import { WikiSubsystem } from './entities/wiki-subsystem.entity';
import { WikiFileMap } from './entities/wiki-file-map.entity';

// Providers — third-party clients
import { OpenAIProvider } from './providers/openai.provider';
import { RedisProvider } from './providers/redis.provider';
import { VectorStoreProvider } from './providers/vector-store.provider';

// Config
import { LlmConfigService } from './services/llm-config.service';

// Services
import { LlmService } from './services/llm.service';
import { EmbeddingService } from './services/embedding.service';
import { WikiPersistenceService } from './services/wiki-persistence.service';
import { WikiCacheService } from './services/wiki-cache.service';
import { RepoIngestionService } from './services/repo-ingestion.service';
import { FileParserService } from './services/file-parser.service';
import { VectorStoreService } from './services/vector-store.service';

// Agents
import { GroupingPlanAgent } from './agents/grouping-plan.agent';
import { FileClassifierAgent } from './agents/file-classifier.agent';
import { DeepAnalysisAgent } from './agents/deep-analysis.agent';

// Orchestrator
import { WikiGenerationOrchestrator } from './orchestrator/wiki-generation.orchestrator';

// Use cases
import { GenerateWikiUseCase } from './usecases/generate-wiki.usecase';
import { GetWikiUseCase } from './usecases/get-wiki.usecase';
import { ListWikisUseCase } from './usecases/list-wikis.usecase';
import { CheckExistingWikiUseCase } from './usecases/check-existing-wiki.usecase';
import { AskQuestionUseCase } from './usecases/ask-question.usecase';

// Controller
import { WikiController } from './controllers/wiki.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Wiki, WikiSubsystem, WikiFileMap]), AuthModule],
  controllers: [WikiController],
  providers: [
    // Third-party client factories
    OpenAIProvider,
    RedisProvider,
    VectorStoreProvider,

    // Config
    LlmConfigService,

    // Core services
    LlmService,
    EmbeddingService,
    WikiPersistenceService,
    WikiCacheService,
    RepoIngestionService,
    FileParserService,
    VectorStoreService,

    // LLM agents
    GroupingPlanAgent,
    FileClassifierAgent,
    DeepAnalysisAgent,

    // Orchestrator
    WikiGenerationOrchestrator,

    // Use cases
    GenerateWikiUseCase,
    GetWikiUseCase,
    ListWikisUseCase,
    CheckExistingWikiUseCase,
    AskQuestionUseCase,
  ],
})
export class WikiModule {}
