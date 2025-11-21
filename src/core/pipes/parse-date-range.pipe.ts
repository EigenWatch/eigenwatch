import { PipeTransform, Injectable, BadRequestException } from "@nestjs/common";
import { DateUtils } from "../utils/date.utils";
import { DateRangeDto } from "src/shared/dto/date-range.dto";

export interface ParsedDateRange {
  from?: Date;
  to?: Date;
}

@Injectable()
export class ParseDateRangePipe
  implements PipeTransform<DateRangeDto, ParsedDateRange>
{
  transform(value: DateRangeDto): ParsedDateRange {
    const result: ParsedDateRange = {};

    if (value.date_from) {
      // Check if it's a relative date (e.g., "7d", "30d")
      if (/^\d+[dDwWmMyY]$/.test(value.date_from)) {
        result.from = DateUtils.parseRelativeDate(value.date_from);
      } else {
        result.from = new Date(value.date_from);
      }

      if (isNaN(result.from.getTime())) {
        throw new BadRequestException("Invalid date_from format");
      }
    }

    if (value.date_to) {
      if (/^\d+[dDwWmMyY]$/.test(value.date_to)) {
        result.to = DateUtils.parseRelativeDate(value.date_to);
      } else {
        result.to = new Date(value.date_to);
      }

      if (isNaN(result.to.getTime())) {
        throw new BadRequestException("Invalid date_to format");
      }
    }

    // Validate range
    if (result.from && result.to && result.from > result.to) {
      throw new BadRequestException("date_from must be before date_to");
    }

    return result;
  }
}
