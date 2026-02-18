import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsNotEmpty, Matches } from "class-validator";

export class ChallengeRequestDto {
  @ApiProperty({
    description: "Ethereum wallet address",
    example: "0x1234567890abcdef1234567890abcdef12345678",
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^0x[a-fA-F0-9]{40}$/, {
    message: "Invalid Ethereum address format",
  })
  address: string;
}

export class VerifySignatureDto {
  @ApiProperty({
    description: "Ethereum wallet address",
    example: "0x1234567890abcdef1234567890abcdef12345678",
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^0x[a-fA-F0-9]{40}$/, {
    message: "Invalid Ethereum address format",
  })
  address: string;

  @ApiProperty({ description: "Signed message signature" })
  @IsString()
  @IsNotEmpty()
  signature: string;

  @ApiProperty({ description: "Nonce from challenge response" })
  @IsString()
  @IsNotEmpty()
  nonce: string;
}

export class RefreshTokenDto {
  @ApiProperty({ description: "Refresh token" })
  @IsString()
  @IsNotEmpty()
  refresh_token: string;
}
