import { IsString, IsNotEmpty, IsOptional, IsObject } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class ChainrailsIntentDto {
  @ApiProperty({
    description: "The sender wallet address",
    example: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  })
  @IsString()
  @IsNotEmpty()
  sender: string;

  @ApiProperty({
    description: "The amount to transfer (in smallest unit or human-readable)",
    example: "20000000",
  })
  @IsString()
  @IsNotEmpty()
  amount: string;

  @ApiPropertyOptional({
    description:
      "The symbol denomination of the amount (e.g. USDC). Defaults to USDC if omitted.",
    example: "USDC",
  })
  @IsString()
  @IsOptional()
  amountSymbol?: string;

  @ApiProperty({
    description: "The input token contract address on the source chain",
    example: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  })
  @IsString()
  @IsNotEmpty()
  tokenIn: string;

  @ApiProperty({
    description: "The source chain identifier",
    example: "ARBITRUM_MAINNET",
  })
  @IsString()
  @IsNotEmpty()
  sourceChain: string;

  @ApiProperty({
    description: "The destination chain identifier",
    example: "BASE_MAINNET",
  })
  @IsString()
  @IsNotEmpty()
  destinationChain: string;

  @ApiProperty({
    description: "The recipient wallet address on the destination chain",
    example: "0xb79541Be080a59fdcE6C0b43219ba56c725eC65e",
  })
  @IsString()
  @IsNotEmpty()
  recipient: string;

  @ApiProperty({
    description: "The refund address if the intent fails or expires",
    example: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  })
  @IsString()
  @IsNotEmpty()
  refundAddress: string;

  @ApiPropertyOptional({
    description: "Optional metadata to attach to the intent",
  })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
