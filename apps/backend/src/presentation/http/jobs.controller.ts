import { Controller, Get, Post, Body, Param, UseGuards, Req, Inject } from "@nestjs/common";
import { SupabaseAuthGuard } from "../guards/supabase-auth.guard";
import { Roles, RolesGuard } from "../guards/roles.guard";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import {
  IAIOrchestrator,
  IAIOrchestratorToken,
} from "../../application/common/ai/ai-orchestrator.interface";

@Controller("jobs")
@UseGuards(SupabaseAuthGuard, RolesGuard)
export class JobsController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(IAIOrchestratorToken)
    private readonly aiOrchestrator: IAIOrchestrator,
  ) {}

  @Get()
  async list(@Req() req: any) {
    const orgId = req.user.orgId || "00000000-0000-0000-0000-000000000000";
    return this.prisma.jobDescription.findMany({
      where: { org_id: orgId, deleted_at: null },
      orderBy: { created_at: "desc" },
    });
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
