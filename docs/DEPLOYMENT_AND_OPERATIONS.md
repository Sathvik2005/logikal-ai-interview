# Lokality AI — Deployment & Operations Playbook

This document outlines the hosting options, production build tasks, Nginx reverse proxy configurations, process managers setup, and BullMQ/Redis scaling blueprints.

---

## 1. PRODUCTION DEPLOYMENT BLUEPRINTS

Lokality AI runs as two modular service layers:
1.  **Frontend Server (TanStack Start)**: Serves static assets and runs server function API proxies.
2.  **Backend Service (NestJS API & WS)**: Hosts REST endpoints, WebSocket gateways, and background task queues on port 3000.

### 1.1. Process Management (PM2 Setup)
In production environments, use PM2 to manage application lifecycles, enabling automatic restarts on crashes and clustering across CPU cores.

Create an ecosystem config file `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [
    {
      name: 'lokality-backend',
      script: 'dist/src/main.js',
      cwd: './backend',
      instances: 'max',
      exec_mode: 'cluster',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    },
    {
      name: 'lokality-frontend',
      script: 'node_modules/.bin/vinxi',
      args: 'start',
      instances: 1,
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    }
  ]
};
```

To build and launch the ecosystem:
```bash
# Build Backend
cd backend
npm run build

# Build Frontend
cd ..
npm run build

# Start PM2
pm2 start ecosystem.config.js --env production
```

---

## 2. NGINX REVERSE PROXY & SSL CONFIGURATION

We use Nginx as a reverse proxy, SSL termination layer, and rate limiter.

Example Nginx site config `/etc/nginx/sites-available/recruitment.lokality.ai`:
```nginx
server {
    listen 80;
    server_name recruitment.lokality.ai;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name recruitment.lokality.ai;

    ssl_certificate /etc/letsencrypt/live/recruitment.lokality.ai/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/recruitment.lokality.ai/privkey.pem;

    # Rate Limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=30r/s;

    # Frontend Server Proxy
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API Route Proxy
    location /api {
        limit_req zone=api_limit burst=50 nodelay;
        proxy_pass http://localhost:3000/api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket Socket.IO Routing Proxy
    location /socket.io/ {
        proxy_pass http://localhost:3000/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## 3. PROD PRODUCTION SCALING: SWAPPING TO REDIS & BULLMQ

For development, the platform runs tasks using `InMemoryQueueService`. In production, this can be swapped to **BullMQ** and **Redis** to support scaling across multiple worker instances.

### 3.1. Enable Redis Configuration
1.  Verify that Redis is installed and running on your infrastructure.
2.  Install NestJS BullMQ integration:
    `npm install @nestjs/bullmq bullmq`
3.  Modify [app.module.ts](file:///e:/logikaiinterview/backend/src/app.module.ts) to register the Redis connection module:
    ```typescript
    import { BullModule } from '@nestjs/bullmq';

    @Module({
      imports: [
        BullModule.forRoot({
          connection: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379', 10)
          }
        }),
        BullModule.registerQueue({
          name: 'evaluation-queue'
        })
      ]
    })
    ```
4.  Replace `IQueueServiceToken` class binding from `InMemoryQueueService` to a new `BullQueueService` wrapper that calls `Queue.add()`. No modifications are required in application services (`EvaluationService` or `CandidateWorkflowService`) due to the DI token abstraction.
