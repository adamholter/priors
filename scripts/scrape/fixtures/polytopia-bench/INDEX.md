# Polytopia Bench: current results

**13 models · 65 completed coding attempts · 23,400 audited final games.**

Each attempt has one continuous 40-minute allowance to write and practice a Rust bot. The frozen submission plays six opponents × three map families × ten layouts × both seats: 360 games. Scores are panel points /100 (win 1, draw ½), reported as mean ± sample SD over five attempts. They are not expert win rates.

The October 31 archive remains intact. Claude Fable 5.2 was added on November 10 using the identical frozen coder image, game/reference hashes, maps, seats and runtime limits. The original evaluation maps have since been published; they remain outside the follow-up’s offline coding sandbox. The follow-up uses parallel grading and the local CLI subscription proxy.

**Fable 5.2 restart disclosure:** Two original sessions were stopped during unbounded filesystem searches and replaced. The interrupted sessions are archived and excluded. This differs from the original uninterrupted five-attempt procedure. Its result combines three retained original attempts and two replacements. The interrupted conversations and cutoff sources are included in the follow-up archive.

| Model | Panel points /100 | Champion wins /300 | Evaluated |
|---|---:|---:|---|
| [GPT-6 Astra](runner/docs/skirmish/results/continuous-full-20261031/README.md) | 74.94 ± 6.02 | 8 / 300 | 2026-10-31 |
| [GPT-6.1 Sol](runner/docs/skirmish/results/continuous-full-20261031/README.md) | 74.39 ± 2.92 | 9 / 300 | 2026-10-31 |
| [Gemini 4 Argon](runner/docs/skirmish/results/continuous-full-20261031/README.md) | 64.36 ± 5.80 | 8 / 300 | 2026-10-31 |
| [Claude Fable 5.2](extensions/fable52-20261110/README.md) | 54.33 ± 11.96 | 4 / 300 | 2026-11-10 |
| [Claude Opus 5.5](runner/docs/skirmish/results/continuous-full-20261031/README.md) | 43.42 ± 3.59 | 3 / 300 | 2026-10-31 |
| [Claude Fable 5.1](runner/docs/skirmish/results/continuous-full-20261031/README.md) | 31.89 ± 5.26 | 1 / 300 | 2026-10-31 |
| [Kimi K3.1 Pro](runner/docs/skirmish/results/continuous-full-20261031/README.md) | 31.06 ± 14.41 | 4 / 300 | 2026-10-31 |
| [GLM 5.3](runner/docs/skirmish/results/continuous-full-20261031/README.md) | 30.53 ± 19.06 | 1 / 300 | 2026-10-31 |
| [Qwen 3.8 Max](runner/docs/skirmish/results/continuous-full-20261031/README.md) | 26.56 ± 16.93 | 2 / 300 | 2026-10-31 |
| [GPT-6 Luna](runner/docs/skirmish/results/continuous-full-20261031/README.md) | 19.58 ± 14.66 | 2 / 300 | 2026-10-31 |
| [DeepSeek V4.1 Flash](runner/docs/skirmish/results/continuous-full-20261031/README.md) | 18.36 ± 14.82 | 1 / 300 | 2026-10-31 |
| [DeepSeek V4 Pro](runner/docs/skirmish/results/continuous-full-20261031/README.md) | 15.19 ± 12.88 | 1 / 300 | 2026-10-31 |
| [MiniMax M3.1 Flash](runner/docs/skirmish/results/continuous-full-20261031/README.md) | 13.08 ± 11.28 | 1 / 300 | 2026-10-31 |

- [Original October 31 archive: harness, conversations, sources and replays](README.md)
- [Fable 5.2 follow-up: all five submissions, conversations, replays and validation receipts](extensions/fable52-20261110/README.md)
- [Interactive leaderboard and article](https://thekevinz.com/blog/polytopia-bench)

Verify the follow-up locally without Docker or model calls:

```sh
python3 benchmark/tools/verify_extension.py
```

The original archive has its own verifier: `python3 benchmark/tools/verify_archive.py`. Rebuild this index with `python3 benchmark/tools/render_index.py`.
