import { PipeTransform, Injectable } from "@nestjs/common";
import { PAGINATION_CONSTANTS } from "src/shared/constants/pagination.constants";
import { PaginationDto } from "src/shared/dto/pagination.dto";

export interface ParsedPagination {
  limit: number;
  offset: number;
}

@Injectable()
export class ParsePaginationPipe
  implements PipeTransform<PaginationDto, ParsedPagination>
{
  transform(value: PaginationDto): ParsedPagination {
    return {
      limit: value.limit || PAGINATION_CONSTANTS.DEFAULT_LIMIT,
      offset: value.offset || PAGINATION_CONSTANTS.DEFAULT_OFFSET,
    };
  }
}
