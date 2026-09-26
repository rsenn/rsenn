# Roman Leonz Senn

Systems software developer and embedded hardware engineer specializing in low-level C architectures, lightweight runtimes, high-performance embedded systems, and custom QuickJS bindings.

---

### Featured Projects

*   **[shish](https://rsenn.github.io/shish/)** — A minimalist POSIX-ish shell in C (~139 KB) built against `libowfat` without standard `stdio`. Designed for resource-constrained containers, AI agent harnesses, and WebAssembly (`.wasm`) environments with fork-less execution and built-in core utilities.
*   **[qjs-lws](https://rsenn.github.io/qjs-lws/)** — Native C bindings and server architecture bridging the QuickJS engine with `libwebsockets` to provide high-performance, lightweight web server and networking interfaces.
*   **[qjs-opencv](https://rsenn.github.io/qjs-opencv/)** — Computer vision bindings and super-resolution text processing pipelines for QuickJS powered by OpenCV ONNX models.
*   **[qjs-modules](https://rsenn.github.io/qjs-modules/)** — Collection of native C extension modules and runtime integrations for QuickJS.
*   **[qjs-nanovg](https://rsenn.github.io/qjs-nanovg/)** — NanoVG vector graphics bindings for QuickJS, enabling hardware-accelerated 2D rendering directly from JavaScript.
*   **[qjs-ffi](https://rsenn.github.io/qjs-ffi/)** — libffi and `dlopen` for QuickJS: call C functions and pass JS callbacks without writing glue code, with generated bindings for cairo, SDL2, freetype, libcurl and more.
*   **[qjs-glfw](https://github.com/rsenn/qjs-glfw/)** — GLFW windowing and context management bindings for QuickJS.
*   **[qjs-imgui](https://github.com/rsenn/qjs-imgui/)** — Dear ImGui bindings for QuickJS, mirroring the C++ `ImGui::` API for immediate-mode GUIs (typically driven by GLFW + OpenGL).
*   **[qjs-sound](https://github.com/rsenn/qjs-sound/)** — Audio bindings for QuickJS built on PortAudio, LabSound and SoundTouch.
*   **[qjs-debugger](https://github.com/rsenn/qjs-debugger/)** — A gdb-style source-level debugger for QuickJS, written in JavaScript, with a terminal REPL and a nanovg/glfw GUI frontend.

The `qjs-*` projects are built against my **[QuickJS fork](https://github.com/rsenn/quickjs/)** (branch `cxx-designated`): a CMake-ified `qjs` with a module search path and [Koushik Dutta](https://github.com/koush)'s [debugger implementation for QuickJS](https://github.com/koush/quickjs) (see also his [VS Code debug adapter](https://github.com/koush/vscode-quickjs-debug)). It is required to build them.

---

### Embedded & Hardware

*   **[pictest](https://github.com/rsenn/pictest/)** — PIC firmware test bench and experiments.
*   **[piclib](https://github.com/rsenn/piclib/)** — Small C drivers for PIC peripherals (ADC, comparator, 7-segment displays, DS18B20 and more).
*   **[libpicp](https://github.com/rsenn/libpicp/)** — Portable Microchip PIC library.
*   **[USB-Stack](https://github.com/rsenn/USB-Stack/)** — PIC16/PIC18 USB device stack with ping-pong buffering and endpoints 0–7.
*   **[USB-uC](https://github.com/rsenn/USB-uC/)** — USB bootloader that makes a PIC appear as a thumb drive; program it by dragging and dropping a hex file.
*   **[picstick_25k50](https://github.com/rsenn/picstick_25k50/)** — PIC18F25K50 Pinguino-compatible USB stick.
*   **[picstick_27j53](https://github.com/rsenn/picstick_27j53/)** — PIC18F27J53 Pinguino-compatible USB stick.
*   **[picstick_shield](https://github.com/rsenn/picstick_shield/)** — Development shield PCB for the picstick.
*   **[lc-meter](https://github.com/rsenn/lc-meter/)** — Inductance/capacitance meter using a PIC16F876A and a Nokia 3310 LCD.
*   **[insider](https://github.com/rsenn/insider/)** — INSIDER PIC tool: firmware, PCB and manual.
*   **[ipe32](https://github.com/rsenn/ipe32/)** — Assembly source with NASM, TASM and YASM builds.
*   **[an-tronics](https://github.com/rsenn/an-tronics/)** — Collection of analogue electronics circuits and PCBs (40106/4069 synth, 555 oscillator, all-band receiver and others).
*   **[thomson-calculator](https://github.com/rsenn/thomson-calculator/)** — Calculator for Thomson's formula.

### Other Software

*   **[chaosircd](https://rsenn.github.io/chaosircd/)** — IRC daemon built around runtime-reloadable modules: every client command, channel mode, user mode and flood check is a module.
*   **[c-utils](https://github.com/rsenn/c-utils/)** — C utility library and command-line tools built on libowfat, with containers such as ranges, string arrays and lists.
*   **[sw-utils](https://github.com/rsenn/sw-utils/)** — Command-line utilities, built with autotools.
*   **[libweb](https://github.com/rsenn/libweb/)** — Collection of browser-side JavaScript libraries and helpers.
*   **[scripts](https://github.com/rsenn/scripts/)** — Miscellaneous scripts.
*   **[beatflower](https://github.com/rsenn/beatflower/)** — Music visualisation plugin for xmms 1.2.x on Linux.
*   **[Ba-dum-tss](https://github.com/rsenn/Ba-dum-tss/)** — Step sequencer for real-time synthesis of drums and bass.

---

### Get in Touch

I am available for remote contracting, engineering collaborations, and custom systems development. 

*   **GitHub:** [rsenn](https://github.com/rsenn)
*   **Contact:** *[roman.l.senn@gmail.com]*
