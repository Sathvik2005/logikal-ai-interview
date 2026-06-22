import { Controller, Get, Post, Param, Body, Req, UseGuards } from "@nestjs/common";
import { SupabaseAuthGuard } from "../guards/supabase-auth.guard";
import { Roles, RolesGuard } from "../guards/roles.guard";
import { PrismaService } from "../../infrastructure/database/prisma.service";

@Controller("personas")
@UseGuards(SupabaseAuthGuard, RolesGuard)
export class PersonasController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Req() req: any) {
    const orgId = req.user.orgId || "00000000-0000-0000-0000-000000000000";
    return this.prisma.persona.findMany({
      where: { org_id: orgId },
      orderBy: { created_at: "desc" },
    });
  }

  @Get(":id")
  async getOne(@Param("id") id: string) {
    return this.prisma.persona.findUnique({
      where: { id },
      include: { versions: { orderBy: { version: "desc" } } },
    });
  }

  @Post()
  @Roles("recruiter", "admin")
  async upsert(@Req() req: any, @Body() body: any) {
    const orgId = req.user.orgId || "00000000-0000-0000-0000-000000000000";
    const userId = req.user.userId;

    let persona: any;

    if (body.id) {
      persona = await this.prisma.persona.update({
        where: { id: body.id },
        data: {
          name: body.name,
          persona_type: body.personaType || "technical",
          tone: body.tone,
          difficulty: body.difficulty,
          prompt: body.prompt,
          config: body.config || {},
          updated_at: new Date(),
        },
      });
    } else {
      persona = await this.prisma.persona.create({
        data: {
          org_id: orgId,
          created_by: userId,
          name: body.name,
          persona_type: body.personaType || "technical",
          tone: body.tone,
          difficulty: body.difficulty,
          prompt: body.prompt,
          config: body.config || {},
        },
      });
    }

    // Automatically snapshot a new version
    const latestVersion = await this.prisma.personaVersion.findFirst({
      where: { persona_id: persona.id },
      orderBy: { version: "desc" },
    });
    const versionNum = latestVersion ? latestVersion.version + 1 : 1;

    await this.prisma.personaVersion.create({
      data: {
        persona_id: persona.id,
        org_id: orgId,
        version: versionNum,
        system_prompt: body.prompt || "You are Aria, a warm, professional AI interviewer.",
        rubric: body.config?.rubric || {},
        created_by: userId,
      },
    });

    return persona;
  }
}
