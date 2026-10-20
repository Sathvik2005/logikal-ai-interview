import { INestApplicationContext, Logger } from "@nestjs/common";
import { IoAdapter } from "@nestjs/platform-socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";
import { ServerOptions } from "socket.io";

/**
 * Socket.IO adapter that fans room broadcasts out through Redis, so live-interview events reach clients
 * connected to any backend instance. Enabled only when `REDIS_URL` is set; otherwise the default in-process
 * adapter is used (fine for a single instance).
 */
export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor?: ReturnType<typeof createAdapter>;

  constructor(app: INestApplicationContext) {
    super(app);
  }

  /** Returns true when Redis fan-out is active. */
  connectToRedis(url: string | undefined): boolean {
    if (!url) return false;
    const pub = new Redis(url, { maxRetriesPerRequest: null });
    const sub = pub.duplicate();
    for (const client of [pub, sub]) {
      client.on("error", (err) => this.logger.error(`Redis error: ${err.message}`));
    }
    this.adapterConstructor = createAdapter(pub, sub);
    this.logger.log("Socket.IO is using the Redis adapter (multi-instance ready).");
    return true;
  }

  createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, options);
    if (this.adapterConstructor) server.adapter(this.adapterConstructor);
    return server;
  }
}
