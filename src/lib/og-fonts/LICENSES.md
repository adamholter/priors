# Share-card font licenses

Fonts here are vendored so cards render with no runtime fetch.

- SIL Open Font License 1.1 (free to use and embed, not to sell alone; no Reserved Font Name use for modified versions): Inter, Newsreader, JetBrains Mono, DM Sans, Source Serif 4, Geist, Geist Mono, IBM Plex Mono, Outfit, Poppins, Lora (all from Google Fonts), Excalifont (c) 2024 Excalidraw, based on Virgil (c) 2011 Your Own Font Foundry.
- MIT: Comic Shanns (c) 2018 Shannon Miwa, (c) 2023 Jesus Gonzalez et al.
- Switzer: Fontshare free license (commercial use allowed).
- Variable fonts (Geist, Geist Mono, Outfit, Lora) were instanced to static weights with fontTools; glyphs are unchanged. Excalifont and Comic Shanns TTFs are the upstream unicode-range subsets merged (Latin and punctuation, no CJK). The same two also ship as woff2 in `src/app/fonts` for the site.
- Fonts with one weight (Excalifont, Comic Shanns) are used at 400 only: resvg does not synthesize bold.
