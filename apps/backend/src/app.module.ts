import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

// Infrastructure
import { PrismaService } from "./infrastructure/database/prisma.service";
import { PrismaCandidateRepository } from "./infrastructure/database/repositories/candidate.repository";
import { PrismaInterviewRepository } from "./infrastructure/database/repositories/interview.repository";
import { EventEmitterBusService } from "./infrastructure/event-bus/event-emitter-bus.service";
import { InMemoryQueueService } from "./infrastructure/queue/in-memory-queue.service";
import { GeminiOrchestratorService } from "./infrastructure/ai/gemini-orchestrator.service";

// Repository Tokens
import { ICandidateRepositoryToken } from "./domain/candidate/candidate.repository.interface";
import { IInterviewRepositoryToken } from "./domain/interview/interview.repository.interface";
import { IEventBusToken } from "./application/common/event-bus/event-bus.interface";
import { IQueueServiceToken } from "./application/common/queue/queue.service";
import { IAIOrchestratorToken } from "./application/common/ai/ai-orchestrator.interface";

// Application Services
import { StorageService } from "./application/services/storage.service";
import { AppConfigService } from "./application/services/config.service";
import { FeatureFlagsService } from "./application/services/feature-flags.service";
import { PromptLibraryService } from "./application/services/prompt-library.service";
import { NotificationService } from "./application/services/notification.service";

// Application Pipelines
import { CandidateWorkflowService } from "./application/candidate/candidate-workflow.service";
import { FileProcessingPipelineService } from "./application/candidate/file-processing-pipeline.service";
import { VectorMatchingService } from "./application/candidate/vector-matching.service";
import { InterviewEngineService } from "./application/interview/interview-engine.service";
import { EvaluationService } from "./application/interview/evaluation.service";

// Presentation Gateways & Controllers
import { InterviewGateway } from "./presentation/ws/interview.gateway";
import { CandidatesController } from "./presentation/http/candidates.controller";
import { JobsController } from "./presentation/http/jobs.controller";
import { PersonasController } from "./presentation/http/personas.controller";
import { InterviewsController } from "./presentation/http/interviews.controller";
import { ReportsController } from "./presentation/http/reports.controller";
import { AnalyticsController } from "./presentation/http/analytics.controller";
import { ProctoringController } from "./presentation/http/proctoring.controller";
import { QuestionsController } from "./presentation/http/questions.controller";
import { AdminController } from "./presentation/http/admin.controller";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  controllers: [
    CandidatesController,
    JobsController,
    PersonasController,
    InterviewsController,
    ReportsController,
    AnalyticsController,
    ProctoringController,
    QuestionsController,
    AdminController,
  ],
  providers: [
    // Core Services
    PrismaService,
    StorageService,
    AppConfigService,
    FeatureFlagsService,
    PromptLibraryService,
    NotificationService,

    // Interface tokens mapping
    {
      provide: ICandidateRepositoryToken,
      useClass: PrismaCandidateRepository,
    },
    {
      provide: IInterviewRepositoryToken,
      useClass: PrismaInterviewRepository,
    },
    {
      provide: IEventBusToken,
      useClass: EventEmitterBusService,
    },
    {
      provide: IQueueServiceToken,
      useClass: InMemoryQueueService,
    },
    {
      provide: IAIOrchestratorToken,
      useClass: GeminiOrchestratorService,
    },

    // Workflows and engine logic
    CandidateWorkflowService,
    FileProcessingPipelineService,
    VectorMatchingService,
    InterviewEngineService,
    EvaluationService,

    // Realtime Gateways
    InterviewGateway,
  ],
})
export class AppModule {}
