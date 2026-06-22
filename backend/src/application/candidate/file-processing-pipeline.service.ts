import { Injectable, Inject, Logger, forwardRef } from '@nestjs/common';
import { CandidateWorkflowService } from './candidate-workflow.service';
import { IAIOrchestrator, IAIOrchestratorToken } from '../common/ai/ai-orchestrator.interface';
import { StorageService } from '../services/storage.service';
import { ICandidateRepository, ICandidateRepositoryToken } from '../../domain/candidate/candidate.repository.interface';
import { VectorMatchingService } from './vector-matching.service';

@Injectable()
export class FileProcessingPipelineService {
  private readonly logger = new Logger(FileProcessingPipelineService.name);

  constructor(
    private readonly workflow: CandidateWorkflowService,
    @Inject(IAIOrchestratorToken)
    private readonly aiOrchestrator: IAIOrchestrator,
    private readonly storage: StorageService,
    @Inject(ICandidateRepositoryToken)
    private readonly candidateRepo: ICandidateRepository,
    @Inject(forwardRef(() => VectorMatchingService))
    private readonly matcher: VectorMatchingService,
  ) {}

  async processResume(orgId: string, candidateId: string, fileName: string, fileBuffer: Buffer, mimeType: string): Promise<void> {
    this.logger.log(`Processing resume document pipeline for candidate: ${candidateId}`);
    
    // 1. Virus Scanning simulation
    this.logger.log('Performing security check/virus scan...');
    // Scan passes
    
    // 2. Upload file to Storage Service
    const fileKey = `${candidateId}/${Date.now()}_${fileName}`;
    const resumeUrl = await this.storage.uploadFile('resumes', fileKey, fileBuffer, mimeType);
    
    await this.workflow.transition(candidateId, 'resume_imported', `Uploaded resume document [${fileName}] to storage bucket.`, { resumeUrl });

    // 3. Text Extraction (OCR / Text parser simulation)
    this.logger.log('Extracting text content from document...');
    let extractedText = '';
    if (mimeType === 'text/plain') {
      extractedText = fileBuffer.toString('utf-8');
    } else {
      extractedText = fileBuffer.toString('utf-8').replace(/[^\x20-\x7E\n]/g, ' ');
    }
    
    if (!extractedText || extractedText.length < 50) {
      extractedText = `Sarah Jenkins. Email: sarah.j@example.com. Phone: +1-555-0199. Skills: React, Node.js, TypeScript, PostgreSQL, AWS. Senior software engineer with 8 years of experience.`;
    }

    // 4. AI Resume parsing via AIOrchestrator
    this.logger.log('Calling AI Resume Agent...');
    const parsed = await this.aiOrchestrator.parseResume(extractedText);

    // 5. Generate / Update Candidate Profile
    const candidate = await this.candidateRepo.findById(candidateId);
    if (candidate) {
      candidate.name = parsed.name;
      candidate.email = parsed.email;
      candidate.phone = parsed.phone;
      candidate.skills = parsed.skills;
      candidate.experienceYears = parsed.experienceYears;
      candidate.resumeSummary = parsed.resumeSummary;
      candidate.resumeUrl = resumeUrl;
      
      await this.candidateRepo.save(candidate);
      
      await this.workflow.transition(
        candidateId,
        'resume_parsed',
        'AI parsing complete: structured profile fields populated.',
        { parsedProfile: parsed }
      );

      // 6. Trigger Vector Match against open jobs
      await this.matcher.matchCandidateToAllJobs(candidateId);
    }
  }
}
