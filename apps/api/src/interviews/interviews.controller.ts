import { Body, Controller, Get, Headers, Param, Post } from "@nestjs/common";

import { IdempotencyService } from "../common/idempotency.service";
import { validateUlid } from "../common/validation";
import { InterviewsService } from "./interviews.service";

@Controller("interviews")
export class InterviewsController {
  constructor(
    private readonly interviewsService: InterviewsService,
    private readonly idempotencyService: IdempotencyService
  ) {}

  @Post()
  createInterview(@Body() body: unknown, @Headers("idempotency-key") idempotencyKey?: string) {
    return this.idempotencyService.run({
      idempotencyKey,
      requestBody: body,
      handler: () => this.interviewsService.createInterview(body)
    });
  }

  @Get(":interviewId")
  getInterview(@Param("interviewId") interviewId: string) {
    return this.interviewsService.getInterview(validateUlid(interviewId, "interview_id"));
  }

  @Post(":interviewId/answers")
  submitAnswer(
    @Param("interviewId") interviewId: string,
    @Body() body: unknown,
    @Headers("idempotency-key") idempotencyKey?: string
  ) {
    return this.idempotencyService.run({
      idempotencyKey,
      requestBody: { interviewId, body },
      handler: () =>
        this.interviewsService.submitAnswer(validateUlid(interviewId, "interview_id"), body)
    });
  }

  @Post(":interviewId/normalize")
  normalizeInput(
    @Param("interviewId") interviewId: string,
    @Body() body: unknown,
    @Headers("idempotency-key") idempotencyKey?: string
  ) {
    return this.idempotencyService.run({
      idempotencyKey,
      requestBody: { interviewId, body },
      handler: () =>
        this.interviewsService.normalizeInput(validateUlid(interviewId, "interview_id"), body)
    });
  }

  @Post(":interviewId/confirm")
  confirm(
    @Param("interviewId") interviewId: string,
    @Body() body: unknown,
    @Headers("idempotency-key") idempotencyKey?: string
  ) {
    return this.idempotencyService.run({
      idempotencyKey,
      requestBody: { interviewId, body },
      handler: () => this.interviewsService.confirm(validateUlid(interviewId, "interview_id"), body)
    });
  }
}
