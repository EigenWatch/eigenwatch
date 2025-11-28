import { IsOptional, IsEnum } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export enum AVSStatus {
  REGISTERED = "registered",
  UNREGISTERED = "unregistered",
  ALL = "all",
}

export enum AVSSortField {
  DAYS_REGISTERED = "days_registered",
  OPERATOR_SET_COUNT = "operator_set_count",
  REGISTRATION_CYCLES = "registration_cycles",
}

export class ListOperatorAVSDto {
  @ApiPropertyOptional({ enum: AVSStatus, default: AVSStatus.REGISTERED })
  @IsOptional()
  @IsEnum(AVSStatus)
  status?: AVSStatus = AVSStatus.REGISTERED;

  @ApiPropertyOptional({
    enum: AVSSortField,
    default: AVSSortField.DAYS_REGISTERED,
  })
  @IsOptional()
  @IsEnum(AVSSortField)
  sort_by?: AVSSortField = AVSSortField.DAYS_REGISTERED;
}
