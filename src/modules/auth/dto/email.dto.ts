import { ApiProperty } from "@nestjs/swagger";
import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsBoolean,
  IsOptional,
  Length,
} from "class-validator";

export class AddEmailDto {
  @ApiProperty({
    description: "Email address to add",
    example: "user@example.com",
  })
  @IsEmail({}, { message: "Invalid email address" })
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: "Opt-in for risk alerts",
    required: false,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  risk_alerts?: boolean;

  @ApiProperty({
    description: "Opt-in for marketing emails",
    required: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  marketing?: boolean;
}

export class VerifyEmailDto {
  @ApiProperty({
    description: "Email address to verify",
    example: "user@example.com",
  })
  @IsEmail({}, { message: "Invalid email address" })
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: "6-digit verification code",
    example: "123456",
  })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: "Code must be exactly 6 digits" })
  code: string;
}

export class ResendVerificationDto {
  @ApiProperty({
    description: "Email address to resend verification for",
    example: "user@example.com",
  })
  @IsEmail({}, { message: "Invalid email address" })
  @IsNotEmpty()
  email: string;
}
