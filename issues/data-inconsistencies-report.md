# Data Inconsistency Report: Operator Metrics

During the integration of the operator risk profile and general UI cleanup, several data inconsistencies were discovered between different API endpoints/data fields that provide similar metrics. These have been temporarily "unified" in the frontend, but require a permanent fix in the backend or data pipeline.

## 1. Slashing Events Mismatch

**Observed Issue:**
The overview section of the operator profile and the risk analysis section displayed different counts for slashing events.

- **Component:** `OperatorProfile.tsx` (Overview) vs `RiskOverview.tsx` (Risk Tab)
- **Field A (Overview):** `operator.performance_summary.total_slash_events`
- **Field B (Risk):** `risk.metrics.slashing.count` (from `OperatorRiskProfile`)
- **Action Taken:** Frontend now defaults to `risk.metrics.slashing.count` or falls back to the overview field to ensure consistency.
- **Needed Fix:** The pipeline should ensure that the summary statistics in the operator profile table match the derived risk metrics.

## 2. Operational Days Discordance

**Observed Issue:**
The operational history (days active) shown in the top header did not match the "Operational History" card in the Risk section.

- **Field A (Header):** `operator.status.operational_days`
- **Field B (Risk):** `risk.metrics.activity.operational_days`
- **Action Taken:** Frontend now overrides the Risk section's value with the header's value to ensure a uniform user experience.
- **Needed Fix:** These values should be calculated from the same logic in the backend/pipeline to prevent drift.

## 3. Penalty Amount Formatting/Normalization

**Observed Issue:**
The "Total penalties" field displayed extremely large, unformatted wei-like values (e.g., `495996053662666882528`).

- **Field:** `risk.metrics.slashing.lifetime_amount`
- **Context:** This value is currently a raw large number that is difficult for users to read.
- **Action Taken:** The "Total penalties" display has been hidden in the UI for now to avoid confusing users.
- **Recommendation:** The backend/pipeline should provide normalized/formatted values (e.g., in ETH) or clear human-readable strings if this data is to be exposed.

## Technical Debt Note

The current frontend implementation uses "prop-drilling" and manual overrides in `OperatorProfile.tsx` to force these values to align. Fixing this at the data source level will allow for cleaner frontend code and more reliable metrics.
