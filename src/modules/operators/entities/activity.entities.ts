/* eslint-disable @typescript-eslint/no-explicit-any */
export interface ActivityDetails {
  [key: string]: any;
}

export interface OperatorActivity {
  activity_type: string;
  timestamp: string;
  block_number: number;
  description: string;
  details: ActivityDetails;
  transaction_hash: string;
}
