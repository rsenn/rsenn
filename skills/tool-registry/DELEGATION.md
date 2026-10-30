# Delegating to ollama-repl: what worked

One row per real attempt (job type, model, system prompt, what happened, verdict). Verdicts are about
the checked result, not the model's own claim. Newest last. How to delegate: SKILL.md "Delegating to a
local model". Models on this machine: `ollama-repl --provider ollama --model list`.

| Date | Job | Model | System prompt | Result | Verdict |
|---|---|---|---|---|---|
| 2026-10-30 | one-line comment above each of 2 functions in a 2-function C file | qwen2.5-coder (ollama) | delegate-system.md via `/system file` | called for_each itself (the REPL hints that for "each"), both comments correct, nothing else touched, 23 s | works |
| 2026-10-30 | `/each ls m.c :: Read {} and reply with the number of functions` (read-only question) | qwen2.5-coder | none (after `/clear`) | `/each` treats the item as an edit job: "no change made - retrying once", then asked for the next task instead of answering | does not work: ask read-only questions as a plain `send`, not `/each` |

## Rules learned

- Watch the terminal: it mirrors every remote prompt, reply, tool call, nudge. Before 2026-10-30 a read-only question about a file with the word "add" in it made ollama-repl nudge the model into editing the file (fixed in ollama-repl); still check `send /diff` after read-only jobs.
- Edit jobs of "one small change, in files the job names" work; give the file name in the job.
- `/each` is for edits only (it retries when no file changed).
- A prompt containing "every/each/all" makes the REPL append a hint telling the model to use for_each;
  that is what you want for repeated edits, and wrong for a question.
- `/clear` also removes the system prompt: re-send it (`/system file ...`) before the next job.
