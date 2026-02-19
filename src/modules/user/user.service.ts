import {
  Injectable,
  Logger,
  HttpStatus,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { UserRepository } from "../auth/repositories/user.repository";
import { SessionRepository } from "../auth/repositories/session.repository";
import { PreferencesRepository } from "./preferences.repository";
import { AuthUser } from "src/shared/types/auth.types";

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private userRepository: UserRepository,
    private sessionRepository: SessionRepository,
    private preferencesRepository: PreferencesRepository,
  ) {}

  // ==================== PROFILE ====================

  async updateProfile(userId: string, data: { display_name?: string }) {
    const user = await this.userRepository.updateProfile(userId, data);
    this.logger.log(`Profile updated for user ${userId}`);
    return {
      id: user.id,
      wallet_address: user.wallet_address,
      display_name: user.display_name,
      tier: user.tier,
      created_at: user.created_at,
    };
  }

  // ==================== PREFERENCES ====================

  async getPreferences(userId: string) {
    let prefs = (await this.preferencesRepository.findByUserId(userId)) as any;

    // Auto-create default preferences on first access
    if (!prefs) {
      prefs = await this.preferencesRepository.upsert(userId, {});
    }

    return {
      risk_alerts_operator_changes: prefs.risk_alerts_operator_changes,
      risk_alerts_slashing: prefs.risk_alerts_slashing,
      risk_alerts_tvs_changes: prefs.risk_alerts_tvs_changes,
      watchlist_daily_summary: prefs.watchlist_daily_summary,
      watchlist_status_changes: prefs.watchlist_status_changes,
      product_updates: prefs.product_updates,
      newsletter: prefs.newsletter,
    };
  }

  async updatePreferences(
    userId: string,
    data: {
      risk_alerts_operator_changes?: boolean;
      risk_alerts_slashing?: boolean;
      risk_alerts_tvs_changes?: boolean;
      watchlist_daily_summary?: boolean;
      watchlist_status_changes?: boolean;
      product_updates?: boolean;
      newsletter?: boolean;
    },
  ) {
    const prefs = (await this.preferencesRepository.upsert(
      userId,
      data,
    )) as any;
    this.logger.log(`Preferences updated for user ${userId}`);

    return {
      risk_alerts_operator_changes: prefs.risk_alerts_operator_changes,
      risk_alerts_slashing: prefs.risk_alerts_slashing,
      risk_alerts_tvs_changes: prefs.risk_alerts_tvs_changes,
      watchlist_daily_summary: prefs.watchlist_daily_summary,
      watchlist_status_changes: prefs.watchlist_status_changes,
      product_updates: prefs.product_updates,
      newsletter: prefs.newsletter,
    };
  }

  // ==================== SESSIONS ====================

  async getSessions(userId: string, currentSessionToken?: string) {
    const sessions = await this.sessionRepository.findActiveByUser(userId);

    return sessions.map((s) => ({
      id: s.id,
      user_agent: s.device_info,
      ip_address: s.ip_address,
      last_active_at: s.created_at.toISOString(),
      created_at: s.created_at.toISOString(),
      is_current: false, // We can't reliably determine this without the token hash
    }));
  }

  async revokeSession(userId: string, sessionId: string) {
    // Verify the session belongs to this user
    const sessions = await this.sessionRepository.findActiveByUser(userId);
    const session = sessions.find((s) => s.id === sessionId);

    if (!session) {
      throw new NotFoundException("Session not found");
    }

    await this.sessionRepository.revoke(sessionId);
    this.logger.log(`Session ${sessionId} revoked for user ${userId}`);
  }

  async revokeAllSessions(userId: string) {
    await this.sessionRepository.revokeAllForUser(userId);
    this.logger.log(`All sessions revoked for user ${userId}`);
  }

  // ==================== ACCOUNT ====================

  async deleteAccount(userId: string) {
    // Revoke all sessions first
    await this.sessionRepository.revokeAllForUser(userId);
    // Delete the user (cascading deletes handle related records)
    await this.userRepository.deleteUser(userId);
    this.logger.warn(`Account deleted for user ${userId}`);
  }
}
