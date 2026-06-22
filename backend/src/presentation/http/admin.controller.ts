import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, Req } from "@nestjs/common";
import { SupabaseAuthGuard } from "../guards/supabase-auth.guard";
import { Roles, RolesGuard } from "../guards/roles.guard";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { StorageService } from "../../application/services/storage.service";

@Controller("admin")
@UseGuards(SupabaseAuthGuard, RolesGuard)
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  @Get("organizations")
  @Roles("admin")
  async listOrganizations() {
    const orgs = await this.prisma.organization.findMany({
      select: {
        id: true,
        name: true,
        industry: true,
        size: true,
        status: true,
        created_at: true,
      },
      orderBy: { created_at: "desc" },
    });

    const ids = orgs.map((o) => o.id);
    if (ids.length === 0) return [];

    const candidates = await this.prisma.candidate.groupBy({
      by: ["org_id"],
      _count: { id: true },
      where: { org_id: { in: ids }, deleted_at: null },
    });

    const interviews = await this.prisma.interview.groupBy({
      by: ["org_id"],
      _count: { id: true },
      where: { org_id: { in: ids }, deleted_at: null },
    });

    const cCount = new Map<string, number>();
    const iCount = new Map<string, number>();

    candidates.forEach((c) => {
      if (c.org_id) cCount.set(c.org_id, c._count.id);
    });
    interviews.forEach((i) => {
      if (i.org_id) iCount.set(i.org_id, i._count.id);
    });

    return orgs.map((o) => ({
      id: o.id,
      name: o.name,
      industry: o.industry,
      size: o.size,
      status: o.status || "active",
      createdAt: o.created_at.toISOString(),
      candidateCount: cCount.get(o.id) ?? 0,
      interviewCount: iCount.get(o.id) ?? 0,
    }));
  }

  @Get("organizations/:id")
  @Roles("admin")
  async getOrganization(@Param("id") id: string) {
    const o = await this.prisma.organization.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        industry: true,
        size: true,
        status: true,
        created_at: true,
      },
    });
    if (!o) throw new Error("Organization not found");

    const [cc, ic, uc] = await Promise.all([
      this.prisma.candidate.count({ where: { org_id: id, deleted_at: null } }),
      this.prisma.interview.count({ where: { org_id: id, deleted_at: null } }),
      this.prisma.profile.count({ where: { org_id: id } }),
    ]);

    return {
      id: o.id,
      name: o.name,
      industry: o.industry,
      size: o.size,
      status: o.status || "active",
      createdAt: o.created_at.toISOString(),
      candidateCount: cc,
      interviewCount: ic,
      userCount: uc,
    };
  }

  @Patch("organizations/:id")
  @Roles("admin")
  async updateOrganization(@Param("id") id: string, @Body() body: any) {
    await this.prisma.organization.update({
      where: { id },
      data: {
        name: body.name,
        industry: body.industry,
        size: body.size,
        status: body.status,
      },
    });
    return { ok: true };
  }

  @Get("dashboard")
  @Roles("admin")
  async getAdminDashboard() {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const from7 = new Date();
    from7.setHours(0, 0, 0, 0);
    from7.setDate(from7.getDate() - 6);

    const from24h = new Date();
    from24h.setHours(from24h.getHours() - 24);

    const [oc, cc, imo, trendIvs, ec] = await Promise.all([
      this.prisma.organization.count(),
      this.prisma.candidate.count({ where: { deleted_at: null } }),
      this.prisma.interview.count({
        where: {
          deleted_at: null,
          scheduled_at: { gte: startOfMonth },
        },
      }),
      this.prisma.interview.findMany({
        where: {
          deleted_at: null,
          scheduled_at: { gte: from7 },
        },
        select: { scheduled_at: true },
      }),
      this.prisma.errorEvent.count({
        where: {
          created_at: { gte: from24h },
        },
      }),
    ]);

    const byDay = new Map<string, number>();
    for (let i = 0; i < 7; i++) {
      const d = new Date(from7);
      d.setDate(d.getDate() + i);
      byDay.set(d.toISOString().slice(0, 10), 0);
    }

    trendIvs.forEach((i) => {
      if (!i.scheduled_at) return;
      const day = i.scheduled_at.toISOString().slice(0, 10);
      if (byDay.has(day)) {
        byDay.set(day, (byDay.get(day) ?? 0) + 1);
      }
    });

    return {
      orgCount: oc,
      candidateCount: cc,
      interviewsThisMonth: imo,
      errorCount24h: ec,
      trend: Array.from(byDay.entries()).map(([day, count]) => ({
        day: day.slice(5),
        count,
      })),
    };
  }

  @Get("audit-events")
  @Roles("admin")
  async listAuditEvents(@Query("limit") limit?: string, @Query("entityType") entityType?: string) {
    const lim = limit ? parseInt(limit, 10) : 50;
    const where: any = {};
    if (entityType) {
      where.entity_type = entityType;
    }
    return this.prisma.auditEvent.findMany({
      where,
      orderBy: { created_at: "desc" },
      take: Math.min(lim, 200),
    });
  }

  @Get("errors")
  @Roles("admin")
  async listErrorEvents(@Query("limit") limit?: string) {
    const lim = limit ? parseInt(limit, 10) : 50;
    return this.prisma.errorEvent.findMany({
      orderBy: { created_at: "desc" },
      take: Math.min(lim, 200),
    });
  }

  @Post("gdpr/export")
  async requestDataExport(@Req() req: any) {
    const userId = req.user.userId;
    const orgId = req.user.orgId || "00000000-0000-0000-0000-000000000000";

    const [profile, candidates] = await Promise.all([
      this.prisma.profile.findFirst({ where: { id: userId } }),
      this.prisma.candidate.findMany({ where: { user_id: userId } }),
    ]);

    const candIds = candidates.map((c) => c.id);
    const interviews =
      candIds.length > 0
        ? await this.prisma.interview.findMany({ where: { candidate_id: { in: candIds } } })
        : [];

    const bundle = {
      generatedAt: new Date().toISOString(),
      profile,
      candidates,
      interviews,
    };

    const path = `gdpr/${userId}-${Date.now()}.json`;
    const bytes = Buffer.from(JSON.stringify(bundle, null, 2), "utf-8");

    await this.storage.uploadFile("reports", path, bytes, "application/json");
    const signedUrl = await this.storage.getFileSignedUrl("reports", path).catch(() => null);

    const row = await this.prisma.gdprRequest.create({
      data: {
        org_id: orgId,
        user_id: userId,
        request_type: "export",
        status: "ready",
      },
    });

    return { id: row.id, url: signedUrl, path };
  }

  @Post("gdpr/delete")
  async requestAccountDeletion(@Req() req: any) {
    const userId = req.user.userId;
    const orgId = req.user.orgId || "00000000-0000-0000-0000-000000000000";

    await this.prisma.gdprRequest.create({
      data: {
        org_id: orgId,
        user_id: userId,
        request_type: "deletion",
        status: "pending",
      },
    });
    return { ok: true };
  }
}
