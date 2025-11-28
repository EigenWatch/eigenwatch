/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";

@Injectable()
export class ValidationPipe implements PipeTransform<any> {
  private readonly logger = new Logger(ValidationPipe.name);

  async transform(value: any, { metatype, type, data }: ArgumentMetadata) {
    // Log incoming data for debugging
    this.logger.debug(
      `Validating ${type}${data ? ` (${data})` : ""} with metatype ${metatype} → ${JSON.stringify(
        value,
        null,
        2
      )}`
    );

    if (!metatype || !this.toValidate(metatype)) {
      this.logger.debug(`Skipping validation for primitive type.`);
      return value;
    }

    const object = plainToInstance(metatype, value);
    const errors = await validate(object, { whitelist: false });

    if (errors.length > 0) {
      const messages = errors.map((error) =>
        Object.values(error.constraints || {}).join(", ")
      );

      this.logger.warn(
        `Validation failed → ${JSON.stringify(messages, null, 2)}`
      );

      throw new BadRequestException(messages);
    }

    this.logger.debug(`Validation passed.`);
    return object;
  }

  private toValidate(metatype: new (...args: any[]) => unknown): boolean {
    const primitiveTypes: Array<new (...args: any[]) => unknown> = [
      String,
      Boolean,
      Number,
      Array,
      Object,
    ];

    return !primitiveTypes.includes(metatype);
  }
}
