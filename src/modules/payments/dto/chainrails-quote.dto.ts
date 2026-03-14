import { IsString, IsNotEmpty } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class ChainrailsQuoteDto {
  @ApiProperty({
    description: "The amount to transfer",
    example: "20",
  })
  @IsString()
  @IsNotEmpty()
  amount: string;

  @ApiProperty({
    description: "The destination chain identifier",
    example: "BASE_MAINNET",
  })
  @IsString()
  @IsNotEmpty()
  destinationChain: string;

  @ApiProperty({
    description: "The token contract address on the destination chain",
    example: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  })
  @IsString()
  @IsNotEmpty()
  tokenOut: string;
}
