import { Injectable, Logger } from "@nestjs/common";
import { FeedbackRepository } from "./feedback.repository";
import { CreateFeedbackDto } from "./dto/feedback.dto";

@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);

  constructor(private feedbackRepository: FeedbackRepository) {}

  async createFeedback(dto: CreateFeedbackDto, userId: string) {
    const feedback = await this.feedbackRepository.create({
      user_id: userId,
      type: dto.type,
      sentiment: dto.sentiment,
      category: dto.category,
      message: dto.message,
      page_url: dto.page_url,
      section_id: dto.section_id,
      metadata: dto.metadata,
    });

    this.logger.log(
      `Feedback created: type=${dto.type} user=${userId} id=${feedback.id}`,
    );

    return { id: feedback.id };
  }
}
