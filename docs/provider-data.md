# Provider data we could add

Not built. This records where it comes from, so it can be added later without rediscovering it.

## What exists

Which companies serve a model, at what price, in which region, and what they do with prompts. Priors reads none of it today beyond OpenRouter's operational metrics (`openrouter` source: uptime, provider count, throughput, latency, tool-call errors) and the subscription price (`realapipricing`).

## Where to get it

**Benchmark Heaven** (https://benchmarkheaven.com) already joins it. `GET /api/dataset` (about 36 MB of JSON, CORS-open, no key; documented in API.md of github.com/fstandhartinger/model-market-comparison):

| Field | Contents |
| --- | --- |
| `providers[]` (97) | `provider`, `country`, `eu_hosted`, `eu_dedicated`, `non_us`, `hyperscaler`, `data_private` (does the provider train on or keep prompts), `model_count`, `website`, free-text `note` (for example "EU residency via the eu. cross-region profile; ZDR by default") |
| `models[].offers[]` (3,367 across 901 models) | `provider`, `platform`, `input_per_1m`, `output_per_1m`, cache read/write prices, EUR prices, `region` (`eu`, `us`, ...), `hosting_class`, `eu_hosted`, `non_us`, `catalog_status` (`active`, ...), `context_length`, `price_source` (URL and date), `pricing_tier`, `or_provider_slug` |
| `models[].aa_speed`, `aa_reference_price` | Artificial Analysis output tokens per second, first-token latency, input/output/blended list price |
| `models[].token_efficiency` | tokens per task from AA and OpenRouter runs |
| `efficiency` | `openrouter_endpoints`, token-efficiency coverage, the I/O ratio used for blended prices |
| `models[].aa_metadata` | `is_open_weights`, `license_name`, `huggingface_url`, `context_window_tokens` |
| `source_status` | when each upstream was last collected |

Upstream sources behind it, in case we go direct: OpenRouter's public model and endpoint APIs (`/api/v1/models`, per-model `/endpoints`, and its data-policy pages), AWS Bedrock, Azure AI Foundry, Google Vertex, Nebius, Scaleway, IONOS, Mistral, OVHcloud, STACKIT, T-Systems LLM Hub, Chutes and TrustedTokens price pages, GitHub Copilot and Claude Code plan pages.

**boggs.tech** (https://boggs.tech/data/benchmark-dashboard.json, 16 MB) has per-model `open_weights`, `total_parameters`, `active_parameters`, `release_date` and a derived cost index (`cost_index[]`, one number per model, GPT-4.1 = 100).

## What it could drive

- A price-and-region view per model (cheapest provider, EU-hosted only, zero-retention only).
- Real blended price instead of AA's single reference price.
- A sovereignty filter (EU or non-US hosting) for people who need it.

## Cautions

- Benchmark Heaven's code is MIT; the data belongs to each provider. Link the provider's page, as the benchmark sources do.
- Prices change daily and differ by tier and region. Keep `price_source.date` with each value.
- The `eu_hosted` definition is strict (inference inside the EU, not just billing). Reuse it as written rather than inventing one.
