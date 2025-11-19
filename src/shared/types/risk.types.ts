export type RiskLevel = 'low' | 'medium' | 'high';

export interface RiskAssessment {
  score: number;
  level: RiskLevel;
  confidence: number;
  components: RiskComponent[];
  recommendations?: string[];
}

export interface RiskComponent {
  name: string;
  score: number;
  weight: number;
  description: string;
}
