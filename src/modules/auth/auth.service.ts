/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { SignatureVerificationService } from "./signature-verification.service";

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private signatureVerification: SignatureVerificationService
  ) {}

  async generateChallenge(address: string): Promise<any> {
    // TODO: Implement challenge generation
    return null;
  }

  async verifySignature(
    address: string,
    signature: string,
    nonce: string
  ): Promise<any> {
    // TODO: Implement signature verification
    return null;
  }

  async issueToken(user: any): Promise<string> {
    const payload = { sub: user.id, address: user.address };
    return this.jwtService.sign(payload);
  }
}
