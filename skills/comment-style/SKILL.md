---
name: comment-style
description: How to write and format comments in C-like languages (C, C++, JS) - lowercase start, 75 columns, 4-line cap, no semicolons, parameter columns, header blocks, tables, tags. A YAML database of atomic rules plus rulesets per context ("C | quickjs | prototype", "C | diet | implementation", "JS | script | function"). Use whenever you write, rewrite or review a comment, doc block, file banner or prototype comment in a .c/.h/.cpp/.js/.mjs file. Invoked as /comment-style FILE|FILE:LINE... it walks through existing comments interactively, proposes a reformat for each, asks the user, and can emit a sed script.
argument-hint: "FILE | FILE:LINE | FILE:FIRST-LAST ..."
---

# Comment style for C, C++ and JS

The rules are data, in `rules.yaml`: atomic rules named `<group>.<name>`,
and contexts that compose them. This file only says how to use them.

## Use, writing a comment

1. Pick the context for the comment you are about to write: `language | flavor | kind`.
2. Print its ruleset (extends resolved): `scripts/rules-for "C | quickjs | prototype"`.
3. Write the comment to those rules; fix the neighbours you touch.
4. `scripts/rules-for --list` shows every context, `--check` verifies the database.

## Use, `/comment-style TARGET...`, reformatting existing comments

TARGET is `FILE` (every comment of the file), `FILE:LINE` (the comment covering that line) or
`FILE:FIRST-LAST` (every comment overlapping the range). With no argument, ask for targets.

1. **Select.** `scripts/select-comments TARGET...` (NDJSON, built on `extract-comments.js`
   from tool-registry). Each record has `raw` (with delimiters), `start`/`end` as
   `[line, column]`, `trailing` (code before it on the line), `next` (the code that follows,
   to guess the context), `lang` and `lint` (machine-checkable rules it breaks). Say how many
   comments were found; with more than ~30, ask whether to go through all or only those with `lint`.
2. **Ask the mode once**, with AskUserQuestion: edit the files in place, write a sed script only
   (no file touched), or both. Default: sed script only, applied after the user approves the diff.
3. **Per comment**, in file order, read its code context, pick the context (`C | quickjs | prototype`
   and so on; ask only when `next` does not decide it) and print its ruleset once per context,
   not per comment. Then build the default proposal: the comment rewritten to the ruleset, keeping
   the facts and dropping history, with the broken rule names listed. Show before/after and ask
   with AskUserQuestion (up to 4 comments per call; `preview` carries the before/after):
   - **Accept** the default
   - **Alternative**, one or two variants that differ in a real choice (shorter, as table,
     doxygen, example first), not in wording
   - **Skip**, leave the comment as it is
   - **Other**, the user types the new text or an instruction
   Offer "apply the same choice to all remaining comments of this kind" once a pattern shows
   (every `//` to `/* */`, say), and then stop asking for those.
4. **Record** each decision as the select-comments record plus `new`, the replacement text with
   delimiters, lines joined by `\n` and without the indent (`make-sed` adds it). Comments left
   alone have no `new`. Keep the file of decisions in the scratchpad.
5. **Output.** `scripts/make-sed DECISIONS.ndjson OUTDIR [--apply]` writes one `.sed` per file
   and `apply.sh`, prints the unified diff, and refuses a record whose file changed since it was
   selected (select again then). Show the diff, and the script path. Run `apply.sh` only for
   the in-place mode, or when the user says so.
6. **Report** counts (changed, skipped), the contexts used, and any rule the user overrode by
   hand. A new rule the user stated goes into `rules.yaml` (see Editing the database).

Pitfalls: a comment that holds code (commented-out code, a license header, a `\file` doxygen
line) is shown to the user as such, not reformatted by default. A trailing comment stays on its
line. Never change the code part of a line.

## Which skill brings which context

| Working in | Contexts |
|---|---|
| diet-coding (lib/<module>/, lib/<name>.h) | `C \| diet \| implementation`, `C \| diet \| prototype` |
| quickjs-native-bindings | `C \| quickjs \| file`, `member`, `prototype`, `js-facing`, `table`, `implementation` |
| quickjs-scripting | `JS \| script \| file`, `function`, `class`, `data-shape`, `table`, `inline` |

## Editing the database

- One fact per rule; split a rule that holds two. Name it `<group>.<name>`; keep names stable, they are referenced.
- Add the rule to every context that needs it; run `scripts/rules-for --check`.
- Where two rules disagree, merge into one and record the decision in the rule's `note`.
- The project's own `CLAUDE.md` wins over everything here (`precedence.project-rules`).
- A rule the user states in passing goes into `rules.yaml`, not into the skill that happened to be active.
- Log the change in `ChangeLog`; leave committing to the user.

## Open questions

See `open_questions` at the end of `rules.yaml` (C++ `//`, a JSDoc flavor).
