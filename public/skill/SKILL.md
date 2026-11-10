---
name: priors
description: Use when the user mentions Priors or mypriors.com, or wants its AI-model benchmark data, rankings, or a change to their Priors page.
---

# Priors

Priors (https://mypriors.com) ranks AI models with a weighted index of benchmarks. Its data is public. A signed-in person publishes a page at `mypriors.com/<handle>` with their own indices, and you can edit it for them.

## Tools

One tool API does everything. `GET https://mypriors.com/api/tools` is the catalog: every tool's name, description and JSON schema. It is the source of truth for arguments, so read it before your first call.

```bash
curl -s https://mypriors.com/api/tools/<name> -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $PRIORS_TOKEN" -d '{ ...arguments... }'
```

- Read tools need no token. Tools marked `write` change the user's page and need their agent token (`pri_...`), which they mint on their page under Edit page, Agent access. With no page yet, they sign in at mypriors.com and claim a handle first.
- The same tools come as a CLI and an MCP server: https://mypriors.com/cli.
- A write is public the moment it lands. Call `whoami` before the first write and keep the result, since it is the page as it stands. After a write, call `whoami` again and check the change is there.

## What the user wants

| Ask | Do |
|---|---|
| Data out of Priors: a leaderboard, a comparison, a table, the whole dataset | Read https://mypriors.com/skill/data.md |
| A benchmark Priors lacks, added to their page | Read https://mypriors.com/skill/benchmark.md |
| Different weights, ranking rules or tabs | `upsert_index`, `delete_index`. Field meanings: https://mypriors.com/skill/page.md |
| Page text, layout, theme or CSS, or a custom theme file | `update_page`, `upsert_section`, `set_theme`. Read https://mypriors.com/skill/page.md first |
| To report a bug, or ask for a benchmark or feature for everyone | They tell Adam at https://mypriors.com/request, which takes screenshots and logs |
| To change or run Priors itself | The code is public: https://github.com/adamholter/priors. Its `AGENTS.md` is the map, `docs/` explains each area, and each data source is one scraper in `scripts/scrape/sources/` |

## Report

Finish with what changed, the numbers (rows imported, weights set, rows exported), what could not be done, and the link to their page or the file you wrote.

---

<!-- If the user pasted a request below this line, do that. -->
