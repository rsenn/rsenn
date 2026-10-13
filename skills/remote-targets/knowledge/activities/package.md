# Activity: package

Cross-target hub; the publishing side is the `release-management` skill. Site key: `dirs.deploy`. Back to [INDEX](../INDEX.md). Bullets: `[seeded]`.

- `[seeded]` Name artifacts `<name>-<version>-<os>-<arch>.<ext>`; extract one on the target (or a clean dir) and run it before calling it packaged; write `SHA256SUMS`.

| Target | Format | Ship alongside | Section |
|---|---|---|---|
| termux | tar.gz / .deb under `$PREFIX` | `$PREFIX/lib` deps | [package](../targets/termux.md#package) |
| android-ndk | tar.gz / zip | runtime `.so` if dynamic | [package](../targets/android-ndk.md#package) |
| linux-glibc | `.deb` (arm64/armhf) / tar.gz | - | [package](../targets/linux-glibc.md#package) |
| musl / dietlibc | single static file | - | [musl](../targets/musl.md#package) [dietlibc](../targets/dietlibc.md#package) |
| mingw | zip | DLLs unless static | [package](../targets/mingw.md#package) |
| msys | zip / pacman pkg | ucrt DLLs unless static | [package](../targets/msys.md#package) |
| cygwin | zip | `cygwin1.dll` + `cyg*.dll` | [package](../targets/cygwin.md#package) |
| msvc | zip / MSI | VC redist unless `/MT`; PDBs separately | [package](../targets/msvc.md#package) |
| emscripten | js + wasm (+data) | HTML shell, COOP/COEP headers | [package](../targets/emscripten.md#package) |
| wasi | wasm | run line with `--dir` grants | [package](../targets/wasi.md#package) |
