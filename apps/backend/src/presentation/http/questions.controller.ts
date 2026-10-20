import { Controller, Get, Post, Delete, Param, Body, Query, UseGuards, Req } from "@nestjs/common";
import { SupabaseAuthGuard } from "../guards/supabase-auth.guard";
import { Roles, RolesGuard } from "../guards/roles.guard";
import { PrismaService } from "../../infrastructure/database/prisma.service";

@Controller("questions")
@UseGuards(SupabaseAuthGuard, RolesGuard)
export class QuestionsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Req() req: any, @Query("competency") competency?: string) {
    const orgId = req.user.orgId || "00000000-0000-0000-0000-000000000000";
    const where: any = { org_id: orgId, deleted_at: null };
    if (competency) {
      where.competency = competency;
    }
    return this.prisma.question.findMany({
      where,
      orderBy: { created_at: "desc" },
    });
  }

  @Get(":id")
  async getOne(@Param("id") id: string) {
    return this.prisma.question.findUnique({
      where: { id },
    });
  }

  @Post()
  @Roles("recruiter", "admin")
  async upsert(@Req() req: any, @Body() body: any) {
    const orgId = req.user.orgId || "00000000-0000-0000-0000-000000000000";
    const userId = req.user.userId;

    if (body.id) {
      return this.prisma.question.update({
        where: { id: body.id },
        data: {
          competency: body.competency,
          difficulty: body.difficulty,
          type: body.type || "open",
          prompt: body.prompt,
          expected_signals: body.expectedSignals || [],
          updated_at: new Date(),
        },
      });
    }

    return this.prisma.question.create({
      data: {
        org_id: orgId,
        created_by: userId,
        competency: body.competency,
        difficulty: body.difficulty,
        type: body.type || "open",
        prompt: body.prompt,
        expected_signals: body.expectedSignals || [],
      },
    });
  }

  @Post("bulk")
  @Roles("recruiter", "admin")
  async bulkImport(@Req() req: any, @Body() body: { questions: any[] }) {
    const orgId = req.user.orgId || "00000000-0000-0000-0000-000000000000";
    const userId = req.user.userId;

    const data = body.questions.map((q) => ({
      org_id: orgId,
      created_by: userId,
      competency: q.competency,
      difficulty: q.difficulty,
      type: q.type || "open",
      prompt: q.prompt,
      expected_signals: q.expectedSignals || [],
    }));

    await this.prisma.question.createMany({
      data,
    });

    return { ok: true, count: data.length };
  }

  @Delete(":id")
  @Roles("recruiter", "admin")
  async delete(@Param("id") id: string) {
    await this.prisma.question.update({
      where: { id },
      data: { deleted_at: new Date() },
    });
    return { ok: true };
  }
}
