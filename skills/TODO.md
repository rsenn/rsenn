# skills todo

open work on the skills themselves, newest first. tool improvements live in tool-registry/PROPOSALS.md until approved
into a tool project's TODO.md. when an item is done, delete it and note it in the ChangeLog of the skill it touched.

- run qtool --check after every qjs-modules reinstall and update status/verified dates in tool-registry/tools.yaml
- decide between runtime-diff and qjs-ffi-describe (overlap), see tool-registry/PROPOSALS.md
- ChangeLog files exist for tool-registry, diet-coding, quickjs-native-bindings, quickjs-scripting, github-pages, release-management, remote-targets; create one in any other skill the first time it is changed
- try the remote-targets tool ideas on a real device (describe dump on the target runtime, debugger attach) and move their skill-uses entries to tried
- qjs-debugger is scriptable now: after approval add the Tools stanza (batch/json command lines) to release-management and remote-targets, and replace the interactive-only debugging advice in quickjs-scripting section 5
