import { BadRequestException, Injectable } from "@nestjs/common";
import * as mammoth from "mammoth";

export const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;

const PDF = "application/pdf";
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const TXT = "text/plain";

export type ExtractedDocument = {
  /** Plain text for DOCX/TXT. Empty for PDF, which the AI model reads directly from the buffer. */
  text: string;
  mimeType: string;
};

/** Validates an uploaded resume/JD file and extracts text where the AI model can't read the format itself. */
@Injectable()
export class DocumentTextService {
  async extract(
    file: { buffer: Buffer; originalname?: string; mimetype?: string; size?: number } | undefined,
  ): Promise<ExtractedDocument> {
    if (!file?.buffer?.length) throw new BadRequestException("No file uploaded.");
    if (file.buffer.length > MAX_DOCUMENT_BYTES) {
      throw new BadRequestException("File is too large (max 8 MB).");
    }

    const name = (file.originalname ?? "").toLowerCase();
    const type = this.resolveType(name, file.mimetype);

    if (type === PDF) {
      if (file.buffer.subarray(0, 5).toString("latin1") !== "%PDF-") {
        throw new BadRequestException("That file is not a valid PDF.");
      }
      return { text: "", mimeType: PDF };
    }
    if (type === DOCX) {
      try {
        const { value } = await mammoth.extractRawText({ buffer: file.buffer });
        const text = value.trim();
        if (text.length < 20) throw new Error("empty");
        return { text, mimeType: DOCX };
      } catch {
        throw new BadRequestException("Could not read text from that Word document.");
      }
    }
    const text = file.buffer.toString("utf-8").trim();
    if (text.length < 20) throw new BadRequestException("The file has no readable text.");
    return { text, mimeType: TXT };
  }

  private resolveType(name: string, mimetype?: string): string {
    if (name.endsWith(".pdf") || mimetype === PDF) return PDF;
    if (name.endsWith(".docx") || mimetype === DOCX) return DOCX;
    if (name.endsWith(".txt") || mimetype === TXT) return TXT;
    if (name.endsWith(".doc")) {
      throw new BadRequestException("Old .doc files are not supported. Save as .docx or PDF.");
    }
    throw new BadRequestException("Unsupported file type. Upload a PDF, DOCX or TXT file.");
  }
}
