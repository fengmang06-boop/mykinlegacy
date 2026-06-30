import "reflect-metadata";

import { RequestMethod } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";
import { ApiErrorFilter } from "./common/error.filter";
import { BasicValidationPipe } from "./common/basic-validation.pipe";
import { ApiResponseInterceptor } from "./common/response-envelope.interceptor";

async function bootstrap() {
  const apiPort = Number(process.env.API_PORT ?? 4000);
  const app = await NestFactory.create(AppModule, {
    rawBody: true
  });
  app.setGlobalPrefix("api/v1", {
    exclude: [{ path: "health", method: RequestMethod.GET }]
  });
  app.useGlobalPipes(new BasicValidationPipe());
  app.useGlobalFilters(new ApiErrorFilter());
  app.useGlobalInterceptors(new ApiResponseInterceptor());
  app.enableShutdownHooks();
  await app.listen(apiPort);
}

void bootstrap();
