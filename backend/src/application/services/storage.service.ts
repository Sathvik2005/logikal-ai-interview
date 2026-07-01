import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private supabaseClient: SupabaseClient | null = null;
  private isLocal = true;
  private localStorageDir = path.join(process.cwd(), "local-storage");

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (
      supabaseUrl &&
      serviceRoleKey &&
      serviceRoleKey !== "your-service-role-key-here" &&
      serviceRoleKey.length > 50
    ) {
      this.supabaseClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false },
      });
      this.isLocal = false;
      this.logger.log("Storage Service initialized with Supabase storage.");
    } else {
      this.isLocal = true;
      if (!fs.existsSync(this.localStorageDir)) {
        fs.mkdirSync(this.localStorageDir, { recursive: true });
      }
      this.logger.log(
        `Storage Service initialized in local mode. Directory: ${this.localStorageDir}`,
      );
    }
  }

  async onModuleInit() {
    const buckets = ["resumes", "recordings", "reports", "candidate-documents", "avatars"];
    if (this.isLocal || !this.supabaseClient) {
      for (const bucket of buckets) {
        const dirPath = path.join(this.localStorageDir, bucket);
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
        }
      }
      return;
    }

    try {
      const { data: bucketList, error: listError } = await this.supabaseClient.storage.listBuckets();
      if (listError) {
        this.logger.error(`Failed to list Supabase storage buckets: ${listError.message}`);
        return;
      }

      for (const bucket of buckets) {
        const exists = bucketList.some((b) => b.id === bucket);
        if (!exists) {
          this.logger.log(`Creating missing storage bucket: ${bucket}`);
          const isPublic = bucket === "avatars";
          const { error: createError } = await this.supabaseClient.storage.createBucket(bucket, {
            public: isPublic,
          });
          if (createError) {
            this.logger.error(`Failed to create storage bucket ${bucket}: ${createError.message}`);
          }
        }
      }
    } catch (err: any) {
      this.logger.error(`Error initializing storage buckets: ${err.message || err}`);
    }
  }

  async uploadFile(
    bucket: string,
    fileKey: string,
    fileBuffer: Buffer,
    mimeType: string,
  ): Promise<string> {
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

    const { error } = await this.supabaseClient.storage.from(bucket).upload(fileKey, fileBuffer, {
      contentType: mimeType,
      upsert: true,
    });

    if (error) {
      this.logger.error(`Supabase upload error: ${error.message}`);
      throw error;
    }

    const { data: urlData } = this.supabaseClient.storage.from(bucket).getPublicUrl(fileKey);

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

    const { data, error } = await this.supabaseClient.storage.from(bucket).download(fileKey);

    if (error) {
      this.logger.error(`Supabase download error: ${error.message}`);
      throw error;
    }

    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async getFileSignedUrl(bucket: string, fileKey: string): Promise<string> {
    if (this.isLocal || !this.supabaseClient) {
      return `http://localhost:${process.env.PORT || 3000}/api/storage/${bucket}/${fileKey}`;
    }
    const { data, error } = await this.supabaseClient.storage
      .from(bucket)
      .createSignedUrl(fileKey, 3600);

    if (error) {
      this.logger.error(`Supabase createSignedUrl error: ${error.message}`);
      throw error;
    }

    return data.signedUrl;
  }
}
