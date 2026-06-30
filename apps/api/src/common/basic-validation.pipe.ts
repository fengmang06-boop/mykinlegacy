import { Injectable, type PipeTransform } from "@nestjs/common";

@Injectable()
export class BasicValidationPipe implements PipeTransform {
  transform(value: unknown): unknown {
    return value;
  }
}
