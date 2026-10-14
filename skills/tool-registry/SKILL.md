---
name: tool-registry
description: Central registry of the command-line tools (the qjs-* utilities from qjs-modules, qjs-ffi, qjs-debugger and qjs-lws: extract-c, source-scanner, nm-symbols, runtime-diff, qjs-ffi-describe, qjs-ffi-genbindings, qjsm-debugger, list-exports, resolve-imports, highlight, jsonpp, ...) and the learning loop for employing them inside the development skills. Use before analysing C or JS sources, comparing APIs or runtimes, finding dead code, or preparing docs - to find which tool answers the question, how to call it, and what is known about it; and whenever a tool taught something new, the user suggests a new way to use a tool, or a tool needs an improvement. Required by diet-coding, quickjs-native-bindings, quickjs-scripting, github-pages, release-management and remote-targets.
---

# tool-registry: know the tools, use them, get better at it

The machine has a set of purpose-built analysis tools (installed by qjs-modules, qjs-ffi, qjs-debugger, qjs-lws).
The other skills should *use* them instead of hand-rolled grep/awk, and every use should
leave the registry smarter. This skill is the single place that knows the tools.

| File | Holds |
|---|---|
| [`tools.yaml`](tools.yaml) | per tool: what it does, working command lines (`modes`), speed, **verified** gotchas, `status`, rating. Facts about the tool only. |
| [`skill-uses.yaml`](skill-uses.yaml) | per skill: which tool for what, when in that skill's workflow, how, and the `state` (proposed / tried / adopted / rejected). |
| [`ASSESSMENT.md`](ASSESSMENT.md) | rated overview, strategy notes (evidence ladder for dead code, source-level vs link-level). |
| [`PROPOSALS.md`](PROPOSALS.md) | improvements to the tools themselves, waiting for the user's approval to enter a project's TODO.md. |
| [`scripts/qtool`](scripts/qtool) | the runner: `qtool <tool> args...`, `qtool --check`, `qtool --env`. |

## Always run tools through `qtool`

Installed bare, every tool fails with `could not load module 'lexer'`: the native `.so` modules
live in `/usr/local/lib/<triplet>/quickjs`, which qjsm does not search, and the
`QUICKJS_MODULE_PATH` separator is `;`. `scripts/qtool` builds the path. When a tool fails,
run `qtool --check` before debugging anything else. (The proposal to fix it at the source is in
PROPOSALS.md; when it is done, update this section.)

## Start of a task

1. Read `skill-uses.yaml` under the key of the skill you are working in (and `remote-targets` if
   a foreign target is involved). Entries whose `when` matches the task are the tools to try first.
2. Read the tool's entry in `tools.yaml`: `modes` (known-good command lines), `gotchas`, `speed`.
   Do not guess flags from memory; a tool's own `--help` is the second source. Two tools
   (`list-exports`, `extract-structs`) have no real `--help`.
3. Big outputs go to the scratchpad (`-o`), then `jq`/`grep` them; slow runs (extract-c over a
   whole project: seconds to tens of seconds) are done once and reused.
4. Interactive tools (`unused-functions`, `deadwood`, `xml-shell`) need a tty. Prepare their input
   and give the user the exact command; do not try to drive them.
5. **Destructive tools** (`remove-dead-functions -a`, `deadwood`, `jsonpp -w`): only with a clean
   git tree, after showing the plan (dry-run output) to the user, and with a build + test run
   afterwards. `remove-dead-functions` without `-a` is a dry run and is safe.

## Learning loop (do this before finishing the task)

Whenever you used a tool, ask what the run taught, and write it down:

| You learned... | Write it to |
|---|---|
| a command line that works / a flag combination worth reusing | `tools.yaml` `modes` of that tool |
| a surprise, limit, false-positive pattern, wrong output, required cwd/env | `tools.yaml` `gotchas` (only after reproducing it) |
| timing | `tools.yaml` `speed` |
| the tool answered a skill's question well (or not) | `skill-uses.yaml`: set `state: tried` with `evidence` (date + project), or `rejected` with the reason |
| a new use for a tool in a skill | `skill-uses.yaml`: new entry, `state: proposed` |
| a bug, missing option, or rough edge in the tool itself | `PROPOSALS.md` (`[open]`, one precise line, owner project) |
| a tool you had to read the source of because `--help` lacked something | `tools.yaml` + a proposal to fix `--help` |

Rules: verify before writing (run it); change `status` of the tool entry only as far as you ran
it; state the rule and reason, not session history; merge into existing lines rather than append;
fix or delete anything that turned out wrong. Leave committing the `rsenn` repo to the user and
say in the reply what changed here.

## Employing a tool in a skill (needs the user's approval)

`skill-uses.yaml` is the *specification*; a specialized skill only changes when the user agrees.

1. The user gives a hint ("use X for Y in Z") or you notice a recurring need. Investigate first:
   run the tool on a real project, find the command line, measure it, find its limits.
2. Write the usage as a `skill-uses.yaml` entry (`state: tried`, with `evidence`) - a pattern
   with a trigger (`when`) and a command (`how`), not a story.
3. Propose the change to the specialized skill in one or two lines: where in its workflow, and the
   pointer text. **Ask before editing that skill.** On approval: add the pointer to its SKILL.md
   (a "Tools" stanza: `Tools: see tool-registry/skill-uses.yaml key <skill>; run via qtool`, plus at
   most the one or two command lines that belong in the prose), and set the entry to `adopted`.
4. If a tool lacks something the use needs, add it to `PROPOSALS.md`. After the user approves,
   copy it into the owning project's TODO.md (`env.todo_file`) and implement it there; when done
   mark it `done <date>` and update `tools.yaml` (new flag in `modes`, drop the matching gotcha).

A skill that depends on this one carries exactly this stanza and nothing more; tool details are
never copied into it (they would rot).

## Adding a new tool

New command in `/usr/local/bin` (or any tool a project ships): run `--help` and one real input,
add the `tools.yaml` entry (path, group, rating, status, what, modes, gotchas, verified date),
add `skill-uses.yaml` entries for skills it could serve (`state: proposed`), a row in
`ASSESSMENT.md`, and extend `qtool --check` coverage (it reads the ids from `tools.yaml`).
Non-qjs tools (`nm`, `objdump`, `jq`, `cloc`, ...) belong here too once a skill employs them
for something specific; give them `path` and `modes` the same way.

## Maintaining

- Re-run `qtool --check` after any qjs-modules reinstall; update `status`/`verified` dates.
- Keep ratings honest: lower a tool that wasted time, raise one that kept paying off.
- A skill added to the index that uses tools gets a key in `skill-uses.yaml`.
