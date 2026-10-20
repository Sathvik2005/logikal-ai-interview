import { BadRequestException } from "@nestjs/common";
import { DocumentTextService, MAX_DOCUMENT_BYTES } from "./document-text.service";

jest.mock("mammoth", () => ({
  extractRawText: jest.fn(async ({ buffer }: { buffer: Buffer }) => ({
    value: buffer.toString("utf-8"),
  })),
}));

const file = (content: string | Buffer, originalname: string, mimetype?: string) => ({
  buffer: Buffer.isBuffer(content) ? content : Buffer.from(content),
  originalname,
  mimetype,
});

describe("DocumentTextService", () => {
  const svc = new DocumentTextService();

  it("accepts a real PDF and leaves reading it to the AI model", async () => {
    const out = await svc.extract(file("%PDF-1.7 rest of file", "cv.pdf", "application/pdf"));
    expect(out).toEqual({ text: "", mimeType: "application/pdf" });
  });

  it("rejects a file named .pdf that is not a PDF", async () => {
    await expect(svc.extract(file("not a pdf at all, just text", "cv.pdf"))).rejects.toThrow(
      /not a valid PDF/,
    );
  });

  it("extracts text from DOCX", async () => {
    const out = await svc.extract(file("Jane Doe, senior engineer with many years", "cv.docx"));
    expect(out.mimeType).toContain("wordprocessingml");
    expect(out.text).toContain("Jane Doe");
  });

  it("reads plain text and rejects empty text", async () => {
    expect(
      (await svc.extract(file("Some resume content that is long enough", "cv.txt"))).mimeType,
    ).toBe("text/plain");
    await expect(svc.extract(file("  ", "cv.txt"))).rejects.toThrow(/no readable text/);
  });

  it("rejects legacy .doc, unknown types, missing and oversized files", async () => {
    await expect(svc.extract(file("x".repeat(50), "cv.doc"))).rejects.toThrow(
      /\.doc files are not supported/,
    );
    await expect(svc.extract(file("x".repeat(50), "cv.exe"))).rejects.toThrow(
      /Unsupported file type/,
    );
    await expect(svc.extract(undefined)).rejects.toThrow(BadRequestException);
    await expect(
      svc.extract(file(Buffer.alloc(MAX_DOCUMENT_BYTES + 1), "cv.pdf", "application/pdf")),
    ).rejects.toThrow(/too large/);
  });
});
