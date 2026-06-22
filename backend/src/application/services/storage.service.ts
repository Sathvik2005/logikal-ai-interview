import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private supabaseClient: SupabaseClient | null = null;
  private isLocal = true;
  private localStorageDir = path.join(process.cwd(), 'local-storage');

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && serviceRoleKey && serviceRoleKey !== 'your-service-role-key-here' && serviceRoleKey.length > 50) {
      this.supabaseClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false },
      });
      this.isLocal = false;
      this.logger.log('Storage Service initialized with Supabase storage.');
    } else {
      this.isLocal = true;
      if (!fs.existsSync(this.localStorageDir)) {
        fs.mkdirSync(this.localStorageDir, { recursive: true });
      }
      this.logger.log(`Storage Service initialized in local mode. Directory: ${this.localStorageDir}`);
    }
  }

  async uploadFile(bucket: string, fileKey: string, fileBuffer: Buffer, mimeType: string): Promise<string> {
    if (this.isLocal || !this.supabaseClient) {
      const filePath = path.join(this.localStorageDir, bucket, fileKey);
      const dirPath = path.dirname(filePath);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      fs.writeFileSync(filePath, fileBuffer);
      this.logger.log(`Uploaded file to local storage: bucket=${bucket}, key=${fileKey}`);
      return `http://localhost:${process.env.PORT || 3000}/api/storage/${bucket}/${fileKey}`;
    }

    const { error } = await this.supabaseClient.storage
      .from(bucket)
      .upload(fileKey, fileBuffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (error) {
      this.logger.error(`Supabase upload error: ${error.message}`);
      throw error;
    }

    const { data: urlData } = this.supabaseClient.storage
      .from(bucket)
      .getPublicUrl(fileKey);

    return urlData.publicUrl;
  }

  async downloadFile(bucket: string, fileKey: string): Promise<Buffer> {
    if (this.isLocal || !this.supabaseClient) {
      const filePath = path.join(this.localStorageDir, bucket, fileKey);
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: bucket=${bucket}, key=${fileKey}`);
      }
      return fs.readFileSync(filePath);
    }

    const { data, error } = await this.supabaseClient.storage
      .from(bucket)
      .download(fileKey);

    if (error) {
      this.logger.error(`Supabase download error: ${error.message}`);
      throw error;
    }

    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
