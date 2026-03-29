import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsNotEmpty, IsOptional } from "class-validator";

export class DynamicAuthDto {
  @ApiProperty({ description: "JWT token from Dynamic.xyz SDK" })
  @IsString()
  @IsNotEmpty()
  token: string;
}

export class RefreshTokenDto {
  @ApiProperty({ description: "Refresh token", required: false })
  @IsString()
  @IsOptional()
  refresh_token?: string;
}
