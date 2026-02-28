# AVS Metadata Pipeline Investigation

## 1. Overview of the Investigation

The objective of this investigation is to determine the state of the AVS metadata pipeline. We want to understand:

- How many AVSs are tracked in the system.
- How many have `metadata_uri` configured.
- How many have successfully parsed `metadata_json`.
- The quality of the existing metadata (credible details versus placeholders).
- Why the dashboard UI still displays truncated addresses instead of the expected metadata names and logos.

## 2. Database Investigation & Findings

Using direct SQL queries against the `eigenwatch_analytics` database, we analyzed the `avs` and `avs_metadata` tables.

### Metadata Completeness Stats

**Query Executed:**

```sql
SELECT
    (SELECT count(*) FROM avs) as total_avs,
    (SELECT count(*) FROM avs_metadata) as total_avs_metadata,
    (SELECT count(*) FROM avs_metadata WHERE metadata_uri IS NOT NULL AND metadata_uri != '') as with_metadata_uri,
    (SELECT count(*) FROM avs_metadata WHERE metadata_json IS NOT NULL) as with_metadata_json;
```

**Results:**

- **Total AVSs in system (`avs` table):** 89
- **AVSs with metadata entries (`avs_metadata` table):** 7
- **AVSs with a valid `metadata_uri`:** 7
- **AVSs with parsed `metadata_json`:** 4

_Finding:_ The primary issue is a severe lack of metadata. Out of 89 AVSs, only 7 have a metadata URI assigned, and only 4 have successfully parsed JSON metadata.

### Metadata Quality Analysis

We sampled the available metadata to evaluate its credibility.

**Sample Results:**

1. **Credible Metadata:** `DIN` AVS has a valid GitHub raw URL (`https://raw.githubusercontent.com/DIN-center/eigendata/refs/heads/master/avs/din/metadata.json`) and parsed successfully. It includes a credible name ("DIN"), detailed description, website (`https://din.build/`), and a valid logo URI.
2. **Placeholders:** Some AVSs have placeholder URIs such as `dummy://opset1` with no corresponding JSON data.
3. **Invalid/Unparsed:** Another entry (`https://raw.githubusercontent.com/opolis/eigenlayer-operator-config/refs/heads/main/metada.json`) has a typo in the URL (`metada.json`) or couldn't be parsed, leaving the `metadata_json` and `name` null.

_Finding:_ Even among the 7 AVSs with URIs, several are using dummy placeholders or have typos preventing the JSON from being fetched and parsed into useful data (name, logo, description).

## 3. UI Display Issue Investigation

The user noticed that the frontend still displays truncated addresses (e.g., `0x1234...5678`) rather than the expected AVS metadata (Name, Logo).

This is occurring for two main reasons:

1. **Lack of Underlying Data:** As proven by the SQL queries, 95% of the AVSs simply do not have any metadata populated in the database. When the backend or frontend attempts to display the AVS name, it has to fall back to the address because there is no name stored.
2. **Fallback Logic:** In the frontend or backend mappers, when `avs.avs_metadata.name` is null, the code properly falls back to displaying a truncated version of the `avs.address`.

### Recommended Fixes for the Pipeline

1. **Metadata Source Verification:** The pipeline responsible for populating `avs_metadata` needs to be updated. It currently isn't finding or assigning URIs for the vast majority of the 89 active AVSs on EigenLayer.
2. **Error Handling/Retries:** For URIs that fail to parse (like the typo'd GitHub URL), the pipeline should log these failures so they can be audited, rather than silently leaving the `metadata_json` empty.
3. **Default/Placeholder Upgrades:** Instead of `dummy://` placeholders, we could perhaps use an automated fallback service (like pulling from an EigenLayer GitHub registry) to seed base metadata.

## 4. Deeper Investigation: Missing Core AVS Metrics

As a follow-up, we verified whether other core AVS attributes are populating correctly. Specifically: AVS status, days active, operator sets, allocated USD, and commissions.

**Query Executed:**

```sql
SELECT
    (SELECT count(*) FROM avs) as total_avs,
    (SELECT count(DISTINCT avs_id) FROM operator_sets) as with_operator_sets,
    (SELECT count(DISTINCT avs_id) FROM operator_avs_relationships) as with_operators,
    (SELECT count(DISTINCT avs_id) FROM operator_avs_allocation_summary WHERE total_allocated_magnitude_usd > 0) as with_usd_allocation,
    (SELECT count(DISTINCT avs_id) FROM operator_commission_rates) as with_commissions;
```

**Results:**

- **Total AVSs:** 89
- **AVSs with Operators Mapped:** 81
- **AVSs with Registered Operator Sets:** 6
- **AVSs with Documented Commissions:** 11
- **AVSs with Allocated USD > 0:** 1

_Finding:_ While 81 out of 89 AVSs have relationships mapped to operators, the vast majority are missing vital economic properties. Only 6 have registered operator sets, 11 have commission rates stored, and remarkably, only a single AVS has a tracked USD allocation. The pipeline fetching these specific on-chain metrics (operator sets, asset allocations, and commission splits) requires immediate debugging as it is failing to sync this data for >90% of active EigenLayer AVSs.
