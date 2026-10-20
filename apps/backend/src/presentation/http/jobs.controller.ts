import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Req,
  Inject,
  ServiceUnavailableException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  DocumentTextService,
  MAX_DOCUMENT_BYTES,
} from "../../application/services/document-text.service";
import { SupabaseAuthGuard } from "../guards/supabase-auth.guard";
import { Roles, RolesGuard } from "../guards/roles.guard";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import {
  IAIOrchestrator,
  IAIOrchestratorToken,
} from "../../application/common/ai/ai-orchestrator.interface";

@Roles("recruiter", "admin")
@Controller("jobs")
@UseGuards(SupabaseAuthGuard, RolesGuard)
export class JobsController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(IAIOrchestratorToken)
    private readonly aiOrchestrator: IAIOrchestrator,
    private readonly documentText: DocumentTextService,
  ) {}

  @Get()
  async list(@Req() req: any) {
    const orgId = req.user.orgId || "00000000-0000-0000-0000-000000000000";
    return this.prisma.jobDescription.findMany({
      where: { org_id: orgId, deleted_at: null },
      orderBy: { created_at: "desc" },
    });
  }

  /** Read an uploaded JD (PDF/DOCX/TXT) and return fields to pre-fill the job form. Nothing is saved. */
  @Post("parse-jd")
  @Roles("recruiter", "admin")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_DOCUMENT_BYTES } }))
  async parseJd(@UploadedFile() file: Express.Multer.File) {
    if (!this.aiOrchestrator.isAvailable()) {
      throw new ServiceUnavailableException(
        "JD parsing is not available because AI is not configured.",
      );
    }
    const doc = await this.documentText.extract(file);
    return this.aiOrchestrator.parseJd(doc.text, doc.mimeType, file.buffer);
  }

  @Get(":id")
  async getOne(@Param("id") id: string) {
    return this.prisma.jobDescription.findUnique({
      where: { id },
    });
  }

  @Post()
  @Roles("recruiter", "admin")
  async create(@Req() req: any, @Body() body: any) {
    const orgId = req.user.orgId || "00000000-0000-0000-0000-000000000000";
    const userId = req.user.userId;

    if (body.id) {
      return this.prisma.jobDescription.update({
        where: { id: body.id },
        data: {
          title: body.title,
          department: body.department,
          location: body.location,
          employment_type: body.employmentType,
          seniority: body.seniority,
          description: body.description,
          requirements: body.requirements,
          status: body.status,
          persona_id: body.personaId || null,
          competencies: body.competencies !== undefined ? body.competencies : undefined,
          updated_at: new Date(),
        },
      });
    }

    return this.prisma.jobDescription.create({
      data: {
        org_id: orgId,
        created_by: userId,
        title: body.title,
        department: body.department,
        location: body.location,
        employment_type: body.employmentType,
        seniority: body.seniority,
        description: body.description,
        requirements: body.requirements,
        status: body.status || "draft",
        persona_id: body.personaId || null,
        competencies: body.competencies || {},
      },
    });
  }

  @Post("suggest")
  @Roles("recruiter", "admin")
  async suggest(@Body() body: { title: string; department?: string }) {
    return this.aiOrchestrator.suggestJd(body.title, body.department);
  }

  @Post("ai-assist")
  @Roles("recruiter", "admin")
  async aiAssist(
    @Body()
    body: {
      title: string;
      department?: string;
      experienceLevel: string;
      location?: string;
      employmentType: string;
    },
  ) {
    return this.aiOrchestrator.generateJDAssist(body);
  }
}
