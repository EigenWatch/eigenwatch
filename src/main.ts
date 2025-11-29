import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { LoggerService } from "./core/logging/logger.service";
import { AppConfigService } from "./core/config/config.service";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new LoggerService(),
  });

  const config = app.get(AppConfigService);

  // Global prefix
  app.setGlobalPrefix("api/v1");

  // CORS configuration
  const corsOrigins = config.cors.origins;
  app.enableCors({
    origin: corsOrigins === "*" ? "*" : corsOrigins,
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    })
  );

  // Swagger documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle("EigenWatch API")
    .setDescription(
      "API for comprehensive EigenLayer operator analytics, performance tracking, and network insights"
    )
    .setVersion("1.0")
    .setContact(
      "EigenWatch Team",
      "https://eigenwatch.xyz",
      "eigenwatchteam@gmail.com"
    )
    .addServer("http://localhost:8000", "Development")
    .addServer("https://api-staging.eigenwatch.xyz", "Staging")
    .addServer("https://api.eigenwatch.xyz", "Production")
    .addApiKey(
      {
        type: "apiKey",
        name: "x-api-key",
        in: "header",
        description: "API key for authentication",
      },
      "api-key"
    )
    .addBearerAuth(
      {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "JWT token from wallet signature",
      },
      "jwt"
    )
    .addTag("Operators", "Operator discovery and analytics")
    // .addTag("Strategies", "Strategy-specific analytics")
    // .addTag("AVS", "AVS details and relationships")
    .addTag("Network", "Network-wide statistics")
    // .addTag("Analytics", "Advanced analytics and comparisons")
    // .addTag("Auth", "Authentication and authorization")
    .addTag("Health", "System health checks")
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api/docs", app, document);

  const port = config.server.port;
  await app.listen(port);

  console.log(`
    🚀 EigenWatch API is running!
    
    📚 Documentation: http://localhost:${port}/api/docs
    🏥 Health Check:  http://localhost:${port}/api/v1/health
    🌍 Environment:   ${config.server.nodeEnv}
  `);
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
bootstrap();
