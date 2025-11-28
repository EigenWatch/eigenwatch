import { PaginationDto } from "@/shared/dto/pagination.dto";
import { SortDto } from "@/shared/dto/sort.dto";
import { IntersectionType } from "@nestjs/swagger";
import { ListOperatorsDto } from "./list-operators.dto";

export class FindOperatorsQueryDto extends IntersectionType(
  IntersectionType(PaginationDto, ListOperatorsDto),
  SortDto
) {}
