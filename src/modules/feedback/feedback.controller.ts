import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { RequireAuth } from "src/core/decorators/require-auth.decorator";
import { CurrentUser } from "src/core/decorators/current-user.decorator";
import { AuthUser } from "src/shared/types/auth.types";
import { FeedbackService } from "./feedback.service";
import { CreateFeedbackDto } from "./dto/feedback.dto";

@ApiTags("Feedback")
@Controller("feedback")
@ApiBearerAuth()
@RequireAuth()
export class FeedbackController {
  constructor(private feedbackService: FeedbackService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Submit user feedback" })
  async submitFeedback(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateFeedbackDto,
  ) {
    return this.feedbackService.createFeedback(dto, user.id);
  }
}
