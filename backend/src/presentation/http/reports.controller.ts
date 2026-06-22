import { Controller, Get, Param, Query, UseGuards, Req } from '@nestjs/common';
import { SupabaseAuthGuard } from '../guards/supabase-auth.guard';
import { PrismaService } from '../../infrastructure/database/prisma.service';

@Controller('reports')
@UseGuards(SupabaseAuthGuard)
export class ReportsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Req() req: any) {
    const orgId = req.user.orgId || '00000000-0000-0000-0000-000000000000';
    return this.prisma.interviewReport.findMany({
      where: { org_id: orgId },
      include: { 
        interview: { 
          include: { 
            candidate: true, 
            job: true 
          } 
        } 
      },
      orderBy: { created_at: 'desc' },
    });
  }

  @Get(':interviewId')
  async getOne(@Param('interviewId') interviewId: string) {
    return this.prisma.interviewReport.findUnique({
      where: { interview_id: interviewId },
      include: { 
        interview: { 
          include: { 
            candidate: true, 
            job: true, 
            sessions: { 
              include: { 
                turns: true, 
                events: true 
              } 
            } 
          } 
        } 
      },
    });
  }

  @Get('compare/list')
  async compare(@Query('ids') idsString: string) {
    if (!idsString) return [];
    const ids = idsString.split(',');
    return this.prisma.interviewReport.findMany({
      where: { 
        interview_id: { 
          in: ids 
        } 
      },
      include: { 
        interview: { 
          include: { 
            candidate: true, 
            job: true 
          } 
        } 
      },
    });
  }
}
