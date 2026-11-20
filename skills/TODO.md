# skills todo

open work on the skills themselves, newest first. tool improvements live in tool-registry/PROPOSALS.md until approved
into a tool project's TODO.md. when an item is done, delete it and note it in the ChangeLog of the skill it touched.

- qstack (skills/tool-registry/qstack, scripts/qstack): first cut done 2026-11-20 and registered in tools.yaml; see qstack/README.md. todo: check every option in qstack/modules/Config.in against the projects (only option() lines were read), run one real cmake configure per project from `qstack args`, add the per-module help texts, add a Termux/mingw preset defconfig, decide whether to add a driver that runs the configures in order, ask the user before pointing a skill at it (skill-uses.yaml remote-targets entry is `proposed`), licence headers of the vendored kconfig are GPL-2.0 (COPYING.GPL-2.0 is next to it)
- run qtool --check after every qjs-modules reinstall and update status/verified dates in tool-registry/tools.yaml
- decide between runtime-diff and qjs-ffi-describe (overlap), see tool-registry/PROPOSALS.md
- ChangeLog files exist for tool-registry, diet-coding, quickjs-native-bindings, quickjs-scripting, github-pages, release-management, remote-targets; create one in any other skill the first time it is changed
- try the remote-targets tool ideas on a real device (describe dump on the target runtime, debugger attach) and move their skill-uses entries to tried
