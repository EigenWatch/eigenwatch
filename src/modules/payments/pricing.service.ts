import { Injectable, Logger } from "@nestjs/common";
import { AppConfigService } from "src/core/config/config.service";
import { BetaService } from "../beta/beta.service";

@Injectable()
export class PricingService {
  private readonly logger = new Logger(PricingService.name);

  constructor(
    private readonly config: AppConfigService,
    private readonly betaService: BetaService,
  ) {}

  /**
   * Calculate the PRO price for a specific user, applying any beta discounts.
   * Returns the price as a number in USD/USDC units.
   */
  async calculateProPrice(userId: string): Promise<number> {
    const basePrice = parseFloat(this.config.payments.proPriceUsdc);
    const discountPercent = await this.betaService.getBetaDiscount(userId);

    if (discountPercent) {
      const discountedPrice = basePrice * ((100 - discountPercent) / 100);
      this.logger.log(
        `Applied beta discount of ${discountPercent}% for user ${userId}. Price: ${discountedPrice}`,
      );
      return discountedPrice;
    }

    return basePrice;
  }

  /**
   * Get the base PRO price from config.
   */
  getBaseProPrice(): number {
    return parseFloat(this.config.payments.proPriceUsdc);
  }
}
