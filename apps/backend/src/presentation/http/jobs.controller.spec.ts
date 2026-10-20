import { Test } from "@nestjs/testing";
import { JobsController } from "./jobs.controller";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { IAIOrchestratorToken } from "../../application/common/ai/ai-orchestrator.interface";
import { DocumentTextService } from "../../application/services/document-text.service";
import { SupabaseAuthGuard } from "../guards/supabase-auth.guard";
import { RolesGuard } from "../guards/roles.guard";

describe("JobsController.parseJd", () => {
  let controller: JobsController;
  const ai = { isAvailable: jest.fn(), parseJd: jest.fn() };
  const docs = { extract: jest.fn() };
  const file = { buffer: Buffer.from("x"), originalname: "jd.pdf" } as any;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [JobsController],
      providers: [
        { provide: PrismaService, useValue: {} },
        { provide: IAIOrchestratorToken, useValue: ai },
        { provide: DocumentTextService, useValue: docs },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(JobsController);
  });

  it("returns fields extracted from the uploaded JD", async () => {
    ai.isAvailable.mockReturnValue(true);
    docs.extract.mockResolvedValue({ text: "", mimeType: "application/pdf" });
    ai.parseJd.mockResolvedValue({ title: "Backend Engineer II" });

    await expect(controller.parseJd(file)).resolves.toEqual({ title: "Backend Engineer II" });
    expect(ai.parseJd).toHaveBeenCalledWith("", "application/pdf", file.buffer);
  });

  it("refuses when AI is not configured", async () => {
    ai.isAvailable.mockReturnValue(false);
    await expect(controller.parseJd(file)).rejects.toThrow(/AI is not configured/);
  });
});
