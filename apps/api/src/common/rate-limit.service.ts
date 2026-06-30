import { Injectable } from "@nestjs/common";

@Injectable()
export class RateLimitService {
  assertAllowed(): void {
    return;
  }
}
