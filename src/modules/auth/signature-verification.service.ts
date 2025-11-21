/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable, Logger } from "@nestjs/common";
import { ethers } from "ethers";

@Injectable()
export class SignatureVerificationService {
  private readonly logger = new Logger(SignatureVerificationService.name);

  async verifySignature(
    message: string,
    signature: string,
    expectedAddress: string
  ): Promise<boolean> {
    try {
      const recoveredAddress = ethers.verifyMessage(message, signature);
      return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
    } catch (error: any) {
      this.logger.error(
        `Signature verification failed: ${error?.message || error}`,
        error?.stack
      );
      return false;
    }
  }

  generateMessage(nonce: string): string {
    return `Sign this message to authenticate with EigenWatch.\n\nNonce: ${nonce}`;
  }
}
