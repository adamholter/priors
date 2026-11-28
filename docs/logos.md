# Lab logos

A lab logo sits before a model's name wherever a model is listed (`LabLogo`). The files are in `public/logos`; `src/data/lab-logos.ts` says which file belongs to which lab id.

## How it works

- `LAB_LOGOS` lists every lab, provider and plan seller: id, name, file, aliases, and how the file behaves on a dark page. `labLogo(id)` resolves a lab id or any of its spellings (`fireworks-ai`, `Z AI`, `kimi`), and drops a trailing `-ai`, `-labs`, `-inc`, `-research` or `-team` before giving up.
- A lab with no file is listed with a `letter` reason. It is drawn as its initial: on the lab's chart color when LABS gives it one, else on a plain hairline tile. `other` shows a `?` on the plain tile.
- Files are SVG where the mark was clean, else a 128px PNG. Every file is under 20 KB and has no scripts, `href`s or `url()` outside the file.
- Marks are fitted to one optical size: the longest side fills 86% of the square (92% for wide marks); logos that are a full tile (Xiaomi, Microsoft, Deepgram) fill it.

## Dark pages

`dark` in the entry decides, and `LabLogo` adds `.is-dark` from the page's palette (so a dark profile page works on a light site):

- `flip`: a dark mark (mostly black or near it, such as OpenAI, xAI, Cursor, the black K of Kimi) becomes light with its hues kept: `invert(1) hue-rotate(180deg)`.
- `dim`: a light tile is toned down so it does not glare.
- Nothing: a colored mark or a dark tile stays as it is.

The flag is measured when a logo is added (share of near-black pixels), then reviewed by eye in both themes at 16, 20 and 32px.

## Chart colors

Every lab in LABS has a chart color, and a dark-page color in `DARK_LAB_COLORS` (`src/components/chart/palette.ts`). New colors are the logo's brand color, nudged only where it sat within OKLab distance 6 of an existing lab (the labs added from `other` are held to at least 4.7 in light and 3.2 in dark: with 80 labs the brand colors crowd, and a logo, not a color, is what names a lab). `SpaceXAI` and `Google Cloud` use xAI's and Google's colors: the same companies. `load.ts` applies `LABS` to a snapshot saved before a lab was named or colored, so an old snapshot reads like today's.

## Labs hiding in `other`

A model the family patterns cannot place is filed `aa-<slug>`; its lab was `other` unless Artificial Analysis's creator was one of twenty. Now every AA creator that is a lab in `lab-logos.ts` is that lab (`aaCreatorLab` in `src/data/lab-identity.ts`): the scraper does it (`aa-identity.ts`), and `withLabIdentity` does it for snapshots saved before (Granite to IBM, LFM to Liquid AI, Solar to Upstage, Nova to Amazon, Phi to Microsoft). AA files Nova under AWS and Phi under Azure, so those two are mapped by hand. Only `other` ever moves, a provider or plan seller is never a model's lab, and a model nobody credits (AlephProver, Aristotle) stays `other` with its `?` tile. `model-labels.ts` and `normalize.ts` carry the same labs for the spellings other boards use (`ibm-granite/granite-4.0-h-small`, `Command A`).

## Adding a lab

`lab-logos.test.ts` fails when a lab in LABS has neither a logo entry nor a `letter` reason, when a listed file is missing, when a file in `public/logos` is listed by no lab, or when a lab in LABS has no chart color. A lab that only a scrape added (in the latest snapshot but not in LABS) never fails the test, because a data push must not block a deploy: the test warns, the app shows its letter tile, and the fix is a logo entry plus a LABS color.

1. Find the mark: Artificial Analysis serves creator logos at `artificialanalysis.ai/img/logos/<creator>.svg` (48px tiles: strip the background rectangle); lobehub icons (`@lobehub/icons-static-svg`, `<name>.svg` is mono, `<name>-color.svg` colored); the lab's brand page or GitHub org avatar.
2. Look at it. Trim to the mark, make the background transparent, no scripts or external references.
3. Save it as `public/logos/<lab-id>.svg` (or a 128px `.png`), add the entry, set `dark: "flip"` when it is a black mark.
4. Add the lab to LABS (name, color) and `DARK_LAB_COLORS`.

Nominative use of a company's mark to name its models is the use here. Benchmark sites keep their own favicons (`gamefeel.png` is one).

## Sources

Each file's origin. `lobehub` is `https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg@1.106.0/icons/` (MIT), `aa` is `https://artificialanalysis.ai/img/logos/`, `simple-icons` is `https://cdn.jsdelivr.net/npm/simple-icons@16.38.1/icons/` (CC0).

| Lab id | Name | File | Source |
| --- | --- | --- | --- |
| anthropic | Anthropic | anthropic.svg | lobehub anthropic.svg |
| openai | OpenAI | openai.svg | lobehub openai.svg |
| google | Google | google.svg | lobehub google-color.svg |
| meta | Meta | meta.svg | lobehub meta-color.svg |
| xai | xAI | xai.svg | lobehub xai.svg |
| deepseek | DeepSeek | deepseek.svg | lobehub deepseek-color.svg |
| alibaba | Alibaba | alibaba.svg | lobehub alibaba-color.svg |
| moonshot | Moonshot AI | moonshot.svg | lobehub kimi-color.svg |
| mistral | Mistral | mistral.svg | lobehub mistral-color.svg |
| zhipu | Zhipu | zhipu.svg | lobehub zai.svg (the Z.ai mark GLM ships under; the old Zhipu swirl was retired) |
| minimax | MiniMax | minimax.svg | lobehub minimax-color.svg |
| xiaomi | Xiaomi | xiaomi.svg | aa xiaomi.svg |
| cognition | Cognition | cognition.svg | lobehub devin-color.svg |
| thinking-machines | Thinking Machines | letter only | the brand is a wordmark only (THINKING MACHINES): unreadable at 16px, so a lab-colour initial tile is used |
| tencent | Tencent | tencent.svg | lobehub tencent-color.svg |
| cursor | Cursor | cursor.svg | lobehub cursor.svg |
| ant-group | Ant Group | ant-group.svg | lobehub antgroup-color.svg |
| nvidia | NVIDIA | nvidia.svg | lobehub nvidia-color.svg |
| inception | Inception | inception.svg | lobehub inception.svg |
| poolside | Poolside | poolside.svg | lobehub poolside-color.svg |
| bytedance | ByteDance | bytedance.svg | lobehub bytedance-color.svg |
| baidu | Baidu | baidu.svg | lobehub baidu-color.svg |
| microsoft | Microsoft | microsoft.svg | lobehub microsoft-color.svg |
| deepgram | Deepgram | deepgram.svg | aa deepgram.svg |
| dots-studio | Dots Studio | dots-studio.svg | lobehub dotsstudio.svg |
| fireworks | Fireworks | fireworks.svg | lobehub fireworks-color.svg |
| opengvlab | OpenGVLab | opengvlab.png | https://github.com/OpenGVLab.png |
| mbzuai | MBZUAI | mbzuai.png | https://github.com/MBZUAI.png |
| meituan | Meituan | meituan.svg | lobehub longcat-color.svg |
| openbmb | OpenBMB | openbmb.svg | aa openbmb.svg |
| lm-provers | LM Provers | lm-provers.png | https://huggingface.co/api/organizations/lm-provers/avatar?redirect=true |
| stepfun | StepFun | stepfun.svg | lobehub stepfun-color.svg |
| assemblyai | AssemblyAI | assemblyai.svg | lobehub assemblyai-color.svg |
| cartesia | Cartesia | cartesia.svg | aa cartesia.svg |
| cohere | Cohere | cohere.svg | lobehub cohere-color.svg |
| elevenlabs | ElevenLabs | elevenlabs.svg | lobehub elevenlabs.svg |
| google-cloud | Google Cloud | google-cloud.svg | lobehub googlecloud-color.svg |
| inworld | Inworld | inworld.svg | aa inworld.svg |
| reson8 | Reson8 | reson8.svg | aa reson8.svg |
| spacexai | SpaceXAI | spacexai.svg | aa spacexai.svg |
| other | Other | letter only | other models have no single lab: a neutral tile, never a guessed brand |
| ai21 | AI21 Labs | ai21.svg | lobehub ai21.svg |
| reka | Reka | reka.svg | lobehub reka.svg |
| perplexity | Perplexity | perplexity.svg | lobehub perplexity-color.svg |
| amazon | Amazon | amazon.svg | lobehub nova-color.svg |
| ibm | IBM | ibm.svg | lobehub ibm.svg |
| apple | Apple | apple.svg | lobehub apple.svg |
| snowflake | Snowflake | snowflake.svg | lobehub snowflake-color.svg |
| databricks | Databricks | databricks.svg | lobehub dbrx-color.svg |
| liquid-ai | Liquid AI | liquid-ai.svg | lobehub liquid.svg |
| nous-research | Nous Research | nous-research.png | lobehub nousresearch.svg |
| ai2 | Allen AI | ai2.svg | lobehub ai2-color.svg |
| hugging-face | Hugging Face | hugging-face.svg | lobehub huggingface-color.svg |
| salesforce | Salesforce | salesforce.svg | simple-icons salesforce.svg |
| servicenow | ServiceNow | servicenow.png | https://github.com/ServiceNow.png |
| writer | Writer | writer.png | https://github.com/writer.png |
| sakana | Sakana AI | sakana.svg | lobehub sakana-color.svg |
| stability | Stability AI | stability.svg | lobehub stability-color.svg |
| black-forest-labs | Black Forest Labs | black-forest-labs.svg | lobehub bfl.svg |
| runway | Runway | runway.svg | lobehub runway.svg |
| luma | Luma AI | luma.svg | lobehub luma-color.svg |
| midjourney | Midjourney | midjourney.svg | lobehub midjourney.svg |
| windsurf | Windsurf | windsurf.svg | lobehub windsurf.svg |
| reflection | Reflection | reflection.svg | lobehub reflection-color.svg |
| prime-intellect | Prime Intellect | prime-intellect.svg | aa prime-intellect.svg |
| arcee | Arcee AI | arcee.svg | lobehub arcee-color.svg |
| upstage | Upstage | upstage.svg | lobehub upstage-color.svg |
| lg-ai-research | LG AI Research | lg-ai-research.svg | lobehub lg-color.svg |
| naver | Naver | naver.svg | simple-icons naver.svg |
| sber | Sber | sber.svg | https://commons.wikimedia.org/wiki/Special:FilePath/Sberbank_Logo_2020.svg |
| tii | TII | tii.svg | lobehub tii-color.svg |
| 01-ai | 01.AI | 01-ai.svg | lobehub yi-color.svg |
| baichuan | Baichuan | baichuan.svg | lobehub baichuan-color.svg |
| sensetime | SenseTime | sensetime.svg | lobehub sensenova-color.svg |
| iflytek | iFlytek | iflytek.svg | lobehub spark-color.svg |
| huawei | Huawei | huawei.svg | lobehub huawei-color.svg |
| internlm | InternLM | internlm.svg | lobehub internlm-color.svg |
| kuaishou | Kuaishou | kuaishou.svg | lobehub kwaikat.svg |
| skywork | Skywork | skywork.svg | lobehub skywork-color.svg |
| rwkv | RWKV | rwkv.svg | lobehub rwkv-color.svg |
| unsloth | Unsloth | unsloth.svg | lobehub unsloth-color.svg |
| deepmind | Google DeepMind | deepmind.svg | lobehub deepmind-color.svg |
| essential-ai | Essential AI | essential-ai.svg | lobehub essentialai-color.svg |
| inflection | Inflection AI | inflection.svg | lobehub inflection.svg |
| aleph-alpha | Aleph Alpha | aleph-alpha.svg | lobehub alephalpha.svg |
| yandex | Yandex | yandex.svg | lobehub yandex.svg |
| deep-cogito | Deep Cogito | deep-cogito.svg | lobehub deepcogito-color.svg |
| zyphra | Zyphra | zyphra.svg | aa zyphra.svg |
| openchat | OpenChat | openchat.svg | lobehub openchat-color.svg |
| nex-agi | Nex AGI | nex-agi.svg | aa nex.svg |
| sarvam | Sarvam AI | sarvam.png | aa sarvam.svg |
| motif-technologies | Motif Technologies | motif-technologies.svg | aa motif.svg |
| trillion-labs | Trillion Labs | trillion-labs.svg | aa trillionlabs.svg |
| multiverse-computing | Multiverse Computing | multiverse-computing.svg | aa multiversecomputing.svg |
| sk-telecom | SK Telecom | sk-telecom.svg | aa sktelecom.svg |
| korea-telecom | Korea Telecom | korea-telecom.png | aa korea-telecom.png |
| china-mobile | China Mobile | china-mobile.png | aa china-mobile.png |
| swiss-ai | Swiss AI Initiative | swiss-ai.png | aa swiss-ai-initiative.png |
| nanbeige | Nanbeige | nanbeige.png | aa nanbeige.png |
| agnes-ai | Agnes AI | agnes-ai.svg | aa sapiens.svg |
| apodex | Apodex | apodex.svg | aa apodex.svg |
| ai9stars | AI9Stars | ai9stars.svg | aa ai9stars.svg |
| celeris | Celeris | celeris.svg | aa celeris.svg |
| ifm | Institute of Foundation Models | ifm.svg | aa ifm.svg |
| joy-ai | Joy Future Academy | joy-ai.svg | aa joy-ai.svg |
| krafton | Krafton | krafton.svg | aa krafton.svg |
| lightricks | Lightricks | lightricks.svg | lobehub lightricks.svg |
| hidream | HiDream | hidream.png | aa hidream.png |
| recraft | Recraft | recraft.svg | lobehub recraft.svg |
| ideogram | Ideogram | ideogram.svg | lobehub ideogram.svg |
| krea | Krea | krea.svg | lobehub krea.svg |
| pika | Pika | pika.svg | lobehub pika.svg |
| pixverse | PixVerse | pixverse.svg | lobehub pixverse-color.svg |
| vidu | Vidu | vidu.svg | lobehub vidu-color.svg |
| suno | Suno | suno.svg | lobehub suno.svg |
| udio | Udio | udio.svg | lobehub udio-color.svg |
| decart | Decart | decart.svg | lobehub decart-color.svg |
| manus | Manus | manus.svg | lobehub manus.svg |
| replit | Replit | replit.svg | lobehub replit-color.svg |
| lovable | Lovable | lovable.svg | lobehub lovable-color.svg |
| cline | Cline | cline.svg | lobehub cline.svg |
| openhands | OpenHands | openhands.svg | lobehub openhands-color.svg |
| factory | Factory | factory.png | existing public/logos/factory.png (the brand's app icon) |
| opencode | OpenCode | opencode.svg | lobehub opencode.svg |
| commandcode | Command Code | commandcode.svg | lobehub commandcode.svg |
| ollama | Ollama | ollama.svg | lobehub ollama.svg |
| deeprelay | DeepRelay | deeprelay.png | existing public/logos/deeprelay.png (the brand's app icon) |
| aws | AWS | aws.svg | lobehub aws-color.svg |
| together-ai | Together AI | together-ai.svg | lobehub together-color.svg |
| groq | Groq | groq.svg | lobehub groq.svg |
| cerebras | Cerebras | cerebras.svg | lobehub cerebras-color.svg |
| sambanova | SambaNova | sambanova.svg | lobehub sambanova-color.svg |
| deepinfra | DeepInfra | deepinfra.svg | lobehub deepinfra-color.svg |
| openrouter | OpenRouter | openrouter.svg | lobehub openrouter.svg |
| replicate | Replicate | replicate.svg | lobehub replicate.svg |
| novita | Novita AI | novita.svg | lobehub novita-color.svg |
| siliconflow | SiliconFlow | siliconflow.svg | lobehub siliconcloud-color.svg |
| nebius | Nebius | nebius.svg | lobehub nebius.svg |
| baseten | Baseten | baseten.svg | lobehub baseten.svg |
| lambda | Lambda | lambda.svg | lobehub lambda.svg |
| hyperbolic | Hyperbolic | hyperbolic.svg | lobehub hyperbolic-color.svg |
| crusoe | Crusoe | crusoe.svg | lobehub crusoe-color.svg |
| cloudflare | Cloudflare | cloudflare.svg | lobehub cloudflare-color.svg |
| digitalocean | DigitalOcean | digitalocean.svg | lobehub digitalocean.svg |
| coreweave | CoreWeave | coreweave.svg | aa coreweave.svg |
| parasail | Parasail | parasail.svg | lobehub parasail.svg |
| vercel | Vercel | vercel.svg | lobehub vercel.svg |
| github | GitHub | github.svg | lobehub github.svg |
| azure | Azure | azure.svg | lobehub azure-color.svg |
| bedrock | Amazon Bedrock | bedrock.svg | lobehub bedrock-color.svg |
| friendli | FriendliAI | friendli.svg | lobehub friendli.svg |
| featherless | Featherless | featherless.svg | lobehub featherless-color.svg |
| chutes | Chutes | chutes.svg | lobehub chutes.svg |
| fal | fal | fal.svg | lobehub fal-color.svg |
| modal | Modal | modal.svg | aa modal.svg |
| wandb | Weights & Biases | wandb.svg | lobehub wandb-color.svg |
| venice | Venice | venice.svg | lobehub venice-color.svg |
| poe | Poe | poe.svg | lobehub poe-color.svg |
| gmi-cloud | GMI Cloud | gmi-cloud.svg | lobehub gmicloud.svg |
| ionet | io.net | ionet.svg | lobehub ionet.svg |
| lepton | Lepton AI | lepton.svg | lobehub leptonai-color.svg |
| anyscale | Anyscale | anyscale.svg | lobehub anyscale-color.svg |
| scaleway | Scaleway | scaleway.svg | aa scaleway.svg |
| verda | Verda | verda.svg | aa verda.svg |
| volcengine | Volcengine | volcengine.svg | lobehub volcengine-color.svg |
| modelscope | ModelScope | modelscope.svg | lobehub modelscope-color.svg |
| lmstudio | LM Studio | lmstudio.svg | lobehub lmstudio.svg |
