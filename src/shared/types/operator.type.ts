import { RiskComponent, RiskLevel } from './risk.types';

export interface OperatorWithStats {
  operator: any; // Will be typed properly in entities
  stats: OperatorStats;
  risk: OperatorRisk;
}

export interface OperatorStats {
  totalTVS: string;
  delegatorCount: number;
  activeAVSCount: number;
  operationalDays: number;
}

export interface OperatorRisk {
  riskScore: number;
  riskLevel: RiskLevel;
  factors: RiskComponent[];
}
