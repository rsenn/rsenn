# Delegating to ollama-repl: what worked

One row per real attempt (job type, model, system prompt, what happened, verdict). Verdicts are about
the checked result, not the model's own claim. Newest last. How to delegate: SKILL.md "Delegating to a
local model". Models on this machine: `ollama-repl --provider ollama --model list`.

| Date | Job | Model | System prompt | Result | Verdict |
|---|---|---|---|---|---|
| 2026-10-30 | one-line comment above each of 2 functions in a 2-function C file | qwen2.5-coder (ollama) | delegate-system.md via `/system file` | called for_each itself (the REPL hints that for "each"), both comments correct, nothing else touched, 23 s | works |
| 2026-10-30 | `/each ls m.c :: Read {} and reply with the number of functions` (read-only question) | qwen2.5-coder | none (after `/clear`) | `/each` treats the item as an edit job: "no change made - retrying once", then asked for the next task instead of answering | does not work: ask read-only questions as a plain `send`, not `/each` |
| 2026-10-30 | c-utils genmakefile path.c refactor: delete one function (and its header prototype) per job, 5 jobs | gemma4:e4b | delegate-system.md via `/system file` (absolute path; `~` is not expanded) | .c deletions worked 4 of 5 times; header-prototype deletion/replacement failed 3 of 3 (claimed success, header unchanged, or flattened a multi-line replacement to one line); one job (delete 4 functions) duplicated half the file and left orphaned doc comments, `/undo` only restored the last prompt; `/diff` shows the whole dirty tree, useless unless tree is clean; ctx 16384 overflowed after ~3 jobs without `/clear` | partly: one-function .c deletion only, check the header yourself, one deletion per job |
| 2026-10-31 | c-utils genmakefile path.c refactor: delete dead `path_dirname_alloc` (function + doc comment in path.c; one prototype line each in path.h and genmakefile.h), 3 jobs | qwen3-coder:30b (ollama, think:false, default 16k ctx) | delegate-system.md via `/system file` | all 3 correct: function and doc block really deleted (not commented out), both prototype lines removed with nothing else touched; only flaw: path.c kept 3 blank lines where 1 belongs (fixed by hand); build of genmakefile passes, no references left. First call 474 s (model load + prompt processing of the 359-line file), edits 18-20 s each afterwards | works: one-function deletions in .c and .h, check blank lines |

## Rules learned

- Watch the terminal: it mirrors every remote prompt, reply, tool call, nudge. Before 2026-10-30 a read-only question about a file with the word "add" in it made ollama-repl nudge the model into editing the file (fixed in ollama-repl); still check `send /diff` after read-only jobs.
- Edit jobs of "one small change, in files the job names" work; give the file name in the job.
- `/each` is for edits only (it retries when no file changed).
- A prompt containing "every/each/all" makes the REPL append a hint telling the model to use for_each;
  that is what you want for repeated edits, and wrong for a question.
- `/clear` also removes the system prompt: re-send it (`/system file ...`) before the next job.
