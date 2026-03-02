import { IsString, IsNotEmpty } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class VerifyPaymentDto {
  @ApiProperty({
    description: "The transaction hash of the USDC transfer on Base",
    example: "0x...",
  })
  @IsString()
  @IsNotEmpty()
  txHash: string;
}
