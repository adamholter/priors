![Prinzbench](assets/prinzbench.png)
# prinzbench[^1]
prinzbench is a private benchmark that ranks LLMs based on their ability to conduct legal research and analysis ("legal reasoning") and locate obscure publicly available information online ("needle-in-the-haystack search").

The current leaderboard is set forth immediately below, followed by notes on methodology, grading, model access and specific models' performance.

**IMPORTANT UPDATE**:  This benchmark was created in January 2026, with the goal of testing frontier AI models' ability to conduct legal research.  In June 2026, **gpt-5.6-Sol-Pro** achieved a score of 91/99 on *prinzbench*, effectively saturating it.  My benchmark lasted 6 months!  I extend my heartfelt congratulations to OpenAI - gg!

<!-- LEADERBOARD_START -->
Last updated on July 18, 2026
![Chart-07.18.26](/assets/chart-07-18-26.png)

| Model                       | prinzbench (full) score (x/99) | Legal Research Sub-Score (x/75) | Search Sub-Score (x/24) |
| --------------------------- | -----------------------------: | ------------------------------: | ----------------------: |
| gpt-5.6-sol-pro*            |                             91 |                              67 |                      24 |
| gpt-5.5-pro (extended)*     |                             82 |                              63 |                      19 |
| gpt-5.4 (xhigh)             |                             69 |                              50 |                      19 |
| gpt-5.4-thinking (heavy)    |                             68 |                              49 |                      19 |
| gpt-5.4-thinking (extended) |                             58 |                              43 |                      15 |
| fable-5 (max)               |                             56 |                              49 |                       7 |
| gpt-5.3-codex-high          |                             52 |                              41 |                      11 |
| meta-muse-spark             |                             31 |                              24 |                       7 |
| qwen-q3-max                 |                             25 |                              18 |                       7 |
| sonnet-4.6                  |                              8 |                               8 |                       0 |
<!-- LEADERBOARD_END -->
<font color="#ffffff"></font>* denotes a model accessed in early testing, before public release.
