# Models: how to harness each one

One entry per model, whatever provider or tool drives it (ollama-repl, gemini, openai-compatible,
Claude subagents). What a model is *for*, which system prompt helped or hurt, how it fails, how long
a job takes. Job-by-job outcomes stay in [`DELEGATION.md`](DELEGATION.md); this file holds the
conclusions per model. Facts only after a real run, dated; *unverified* marks anything copied from a
model page or a blog. The ollama-repl harness keeps its own test notes in
`~/Sources/quickjs/qjs-lws/examples/ollama-repl/MODELS.md`.

Machine: i7-6700 (4C/8T, AVX2, DDR4), 32 GB RAM, no swap, RTX 2070 Super 8 GB. Weights up to about
6 GB plus a 16k context fit in VRAM; beyond that layers go to RAM (MoE with few active parameters
stays usable, dense does not).

## System prompt files

Kept next to this file in `prompts/` when one proved itself; name them `<model>-<variant>.md`.
Load with `ollama-repl-ctl send '/system file <absolute path>'` (`~` is not expanded).
Compare variants on the same small job, `git checkout` the files between runs (`/undo` did not
restore them on 2026-10-31).

## Findings that hold for every small local model

- Judge by the diff and the build, never by the reply line: replies claim edits that did not happen.
- One change per job, naming file, function and the exact replacement. Anything with two files or a
  multi-line replacement fails more often.
- A model that cannot match its own `old_string` repeats the identical `edit_file` call until the
  connection drops (seen with qwen3:8b, 2026-10-31, about 16 s per round). Watch the first minute; if
  the same call appears twice, interrupt and rephrase smaller.
- A system prompt is not free: with none, qwen3:8b commented the code out instead of deleting it
  (and nested comment markers); the wording of the rule about *how to delete* is what mattered.

## ollama / qwen3:8b (5.2 GB, dense, fits the GPU)

- Thinking is off in the harness (`think:false`), so `/no_think` in a prompt adds nothing.
- Job: delete one function plus its prototype (path.c / path.h, c-utils).
  - no system prompt: commented both out with `/* ... */` (nested), 99 s
  - `delegate-system.md` (587 chars): commented out, left a duplicate commented copy, 42 s
  - short prompt "edit_file only, empty new_string deletes": deleted the function body, left its doc
    comment, header line replaced by an empty line, then looped on one failing `edit_file`
- Further runs below as they are made.

## ollama / qwen3-coder:30b (18 GB, MoE 3.3B active, partly in RAM)

- 2026-10-31: first model to get every job of the path.c refactor right (delete one function + doc
  comment from .c, one prototype line from each of two headers; 3 of 3, exact `old_string`s, no
  looping, no commented-out code). Only flaw: leaves extra blank lines after a deletion.
- No thinking capability, so the harness sends `think:false` (detect); no system-prompt tuning needed,
  `delegate-system.md` was enough.
- Speed: first call after loading 474 s (load + prompt processing of a 359-line file attached whole),
  then 13-20 s per edit job with a warm model.
- Next: multi-function and multi-line jobs, the cases the 4B-8B models failed.

## ollama / gemma4:e4b (6.6 GB)

- Deleting one function from a `.c` works (4 of 5 jobs); header-prototype edits failed 3 of 3, jobs
  with several functions duplicated half the file (2026-10-30). System prompt: `delegate-system.md`.

## ollama / qwen2.5-coder (7.6B), qwen3.5:4b

- From the harness notes: qwen3.5:4b 25/25 on the per-declaration comment benchmark (best so far);
  qwen2.5-coder writes tool calls as text, needs the harness's text-tool-call shim.

## Candidates for this machine (not run yet, sizes from the ollama pages)

| Model | Size | Fit | Note |
|---|---|---|---|
| `gemma4:26b` | 16-19 GB | MoE, 3.8B active, partly in RAM | LiveCodeBench v6 77.1%, Tau2 68.2% (page) |
| `gemma4:12b` | 7.7-8.0 GB | borderline for 8 GB VRAM | no benchmarks on the page |
| `gemma4:31b` | 19-20 GB | dense, too slow (about 2-3 tok/s) | skip |
