import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty } from "class-validator";

export class InitializePaystackDto {
  @ApiProperty({
    example: "user@example.com",
    description: "The email address of the user making the payment",
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
