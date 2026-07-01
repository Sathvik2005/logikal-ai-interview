import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe, Logger } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

function validateEnvironment() {
  const required = [
    "DATABASE_URL",
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "JWT_SECRET",
    "GEMINI_API_KEY",
    "LOVABLE_API_KEY",
    "RESEND_API_KEY",
  ];
  const missing = required.filter((key) => {
    const val = process.env[key];
    return !val || val.includes("your-") || val.includes("re_your") || val.includes("[YOUR-DB-PASSWORD]");
  });

  if (missing.length > 0) {
    console.error("====================================================");
    console.error("CRITICAL CONFIGURATION ERROR: MISSING ENV VARIABLES");
    console.error("====================================================");
    missing.forEach((key) => {
      console.error(`- ${key} is not configured or uses placeholder value.`);
    });
    console.error("\nPlease configure these in your .env file before starting the application.");
    console.error("====================================================");
    process.exit(1);
  }
}

async function bootstrap() {
  validateEnvironment();
  const logger = new Logger("Bootstrap");
  const app = await NestFactory.create(AppModule);

  // Global prefixes and versioning
  app.setGlobalPrefix("api");
  app.enableCors({
    origin: process.env.FRONTEND_URL || "*",
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
    credentials: true,
  });

  // Enable validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Setup Swagger API documentation
  const config = new DocumentBuilder()
    .setTitle("Lokality AI Recruitment Platform API")
    .setDescription("Enterprise Workflow-Driven Recruitment Intelligence Platform API")
    .setVersion("1.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`Lokality API backend is running on: http://localhost:${port}/api`);
  logger.log(`Swagger documentation is available at: http://localhost:${port}/api/docs`);
}
bootstrap();
