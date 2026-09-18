---
name: quickjs-native-bindings
description: Writing native C/C++ bindings for QuickJS (wrapping a C or C++ library as a loadable QuickJS module). Use whenever creating or modifying a `quickjs-*.c`/`.cpp` binding file, planning/designing a new binding's JS API surface, adding a class/constructor/method/getter to an existing binding, wrapping a C++ class hierarchy, exposing an enum/flag surface, bridging a C callback into JS, or writing an async/Promise-returning native function for QuickJS.
---

# QuickJS native C/C++ bindings

This is a global skill, not tied to one project. It applies to any
`quickjs-*.c`/`.cpp` file (or a from-scratch new one) in any project built
against QuickJS's C API (`quickjs.h`).

It was compiled by reading the official QuickJS examples
(`examples/fib.c`, `examples/point.c`, `tests/bjson.c`) plus five real
binding codebases: `qjs-nanovg` (clean, broad reference), `qjs-opencv`
(C++ inheritance via type erasure), `qjs-sound`'s own `quickjs-stk.cpp`
and `quickjs-labsound.cpp` (two different, deliberate answers to wrapping
a C++ class hierarchy), `qjs-imgui`, `qjs-glfw`, `qjs-rgfw`, `qjs-lws`,
`qjs-ffi`, and `qjs-net`. File:line citations below point at those trees
as a starting point for deeper examples; they may drift as those repos
change, but the patterns are stable.

## 0. Before designing anything: survey existing bindings of the same library

**Don't invent a JS API for a C/C++ library from scratch. Someone has
almost certainly bound it before, in some language, and independent
bindings that converge on the same shape are strong evidence for what
the "natural" JS API should look like too.** Do this survey step before
proposing an API for a *new* binding, and before implementing one, not
after.

**Where to look**: search broadly, not just JS-ecosystem sites, since
even a non-JS binding's naming/argument-shape/error-handling choices are
useful signal. In rough order of how directly they transfer to a JS
design (a binding in a dynamically-typed, GC'd, exception-based language
transfers more directly than one in a language with a very different
type/memory/error model, but check several regardless of language):
- **npm/JSR** (JS/TS, most directly transferable, check first if present)
- **PyPI** (Python: exceptions, GC, duck typing, closest cousin to JS
  semantics among the rest of this list)
- **crates.io** (Rust), **RubyGems** (Ruby), **Hex.pm** (Elixir/Erlang)
- **pkg.go.dev** (Go), **Hackage** (Haskell), **CPAN** (Perl), **Maven**
  (Java/Kotlin), **NuGet** (.NET)
- Also worth checking: the library's own official/reference bindings if
  it ships any (e.g. a C library with an "official" Python or Lua
  wrapper in-tree), and any widely-used wrapper-of-a-wrapper (like
  `pygame.midi`, which wraps PortMidi specifically rather than being a
  general audio/MIDI library, but is a real, heavily-used binding worth
  checking on its own merits).

**Survey at least 2-3 independent bindings before finalizing anything.**
One binding's choices could be idiosyncratic; agreement across several,
written independently, in different languages, is the actual signal.
Pull out, for each:
- Function/method/class naming (verbatim, not paraphrased)
- How resources are opened/closed (constructor vs static factory vs
  separate open-functions-per-mode, e.g. an input/output split)
- How errors surface (exceptions vs error codes/tuples vs `Result`-style
  return values) and what info they carry
- How compound/packed native data is represented (decoded fields vs a
  single packed value, nested vs flat)
- Argument shapes for anything with more than one reasonable JS calling
  convention (three loose args vs one options object, buffer+offset+
  length vs a single view, positional vs named)

**Worked example, from this exact process (PortMidi)**: before settling
on `PortMidiStream`'s API, four independent bindings were surveyed - Go
(`github.com/markbates/portmidi`), Elixir (`hex/portmidi`), Haskell
(`Sound.PortMidi`), and Python (`pyPortMidi`, plus `pygame.midi` as a
second Python data point). All four independently agreed on two things
that had been open questions: **events are decoded** (`{status, data1,
data2, timestamp}`-shaped, not a packed 32-bit value) even though
PortMidi's own C struct packs them, and **opening splits into
input/output-specific constructs** (separate `NewInputStream`/
`NewOutputStream`, `openInput`/`openOutput`, or separate `Input`/
`Output` classes) rather than one constructor with a direction flag.
That convergence is what the final `PortMidiStream.openInput()`/
`.openOutput()` design and decoded-event shape were built on, not a
guess or a single reference implementation.

**Present findings before implementing, and let convention win over
invented vocabulary** unless there's a concrete reason specific to this
project to diverge (an existing local naming convention already
established in sibling `quickjs-*.c` files in the same codebase takes
priority over an external binding's naming when the two genuinely
conflict - match the codebase you're actually adding to first, external
convention second).

**For an *existing* QuickJS binding already in the codebase: never
silently rewrite its API to match what other-language bindings do.**
Surveying other bindings against an *existing* API can surface real
mismatches (a method named differently than every other binding, an
error style that diverges from convention, a resource-lifetime shape
nothing else uses) - when that happens, **offer** the finding and the
specific change to the user and ask before touching anything. The
existing shape may be a deliberate, already-considered divergence, or
changing it may break real consumers already written against it; that's
the user's call to make, not something to "fix" proactively.

## 1. The absolute minimum: a function-only module

Every native module needs this two-phase export dance, no matter how big
it grows. Copy this template (from `quickjs/examples/fib.c`) for a
brand-new module:

```c
#include <quickjs.h>
#include <cutils.h>          // for countof, if not defining it locally

static JSValue
js_myfunc(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst argv[]) {
  int n;
  if (JS_ToInt32(ctx, &n, argv[0]))
    return JS_EXCEPTION;
  return JS_NewInt32(ctx, n * 2);
}

static const JSCFunctionListEntry js_mymod_funcs[] = {
  JS_CFUNC_DEF("myfunc", 1, js_myfunc),
};

static int
js_mymod_init(JSContext *ctx, JSModuleDef *m) {
  return JS_SetModuleExportList(ctx, m, js_mymod_funcs, countof(js_mymod_funcs));
}

#ifdef JS_SHARED_LIBRARY
#define JS_INIT_MODULE js_init_module
#else
#define JS_INIT_MODULE js_init_module_mymod
#endif

JSModuleDef *
JS_INIT_MODULE(JSContext *ctx, const char *module_name) {
  JSModuleDef *m;
  if (!(m = JS_NewCModule(ctx, module_name, js_mymod_init)))
    return NULL;
  JS_AddModuleExportList(ctx, m, js_mymod_funcs, countof(js_mymod_funcs));
  return m;
}
```

**The two-phase protocol, memorize it:**
- `JS_NewCModule(ctx, name, init_cb)` creates the `JSModuleDef` and
  registers `init_cb` to run later, at *instantiation* time.
- Right after `JS_NewCModule` returns, **declare** every export name with
  `JS_AddModuleExport`/`JS_AddModuleExportList` (this must happen before
  `JS_INIT_MODULE` returns).
- Inside `init_cb` (called later), **bind** values to those declared
  names with `JS_SetModuleExport`/`JS_SetModuleExportList`.
- The declared names and the bound names must match exactly, or module
  resolution fails.

**The `#ifdef JS_SHARED_LIBRARY` block is boilerplate, copy it
verbatim**, substituting your module's own suffix. `-DJS_SHARED_LIBRARY`
is what the build passes when compiling for a loadable `.so` (see the
build section below); it switches the exported C symbol to the fixed
name `js_init_module`, which is the exact symbol QuickJS's `dlopen()`-based
module loader looks up at runtime. Without the `#ifdef`, a module built
both statically-linked and as a `.so` would clash on the symbol name.

`JS_CFUNC_DEF(name, length, func)` registers a plain function: `name` is
the JS-visible name, `length` is the function's declared `.length` (JS
arity, independent of how many `argv[]` slots the C function actually
reads), `func` is the C function pointer. The canonical `JSCFunction`
signature is:

```c
static JSValue
js_myfunc(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst argv[])
```

**Prefer `JSValueConst argv[]` over `JSValueConst *argv` in every
signature that declares it** - identical types, but the array-syntax
form documents at the declaration site that `argv` is indexed, fixed-size
(for this call, `argc` elements), and not a pointer meant to be
walked/incremented, which is how it's used everywhere in this skill.
Match whichever form a given codebase already uses when editing existing
code (see section 0's "match the codebase you're adding to" rule), but
default to `argv[]` for anything new.

**Argument-conversion idiom, used everywhere**: every `JS_To*` conversion
function returns nonzero (and has already thrown internally) on failure,
so the standard one-liner is:

```c
if (JS_ToInt32(ctx, &n, argv[0]))
  return JS_EXCEPTION;
```

Same pattern for `JS_ToFloat64`, `JS_ToInt64`, `JS_ToIndex` (use this one,
not `JS_ToInt32`/`JS_ToInt64`, for anything meant as an array/buffer
index or length; it does spec `ToIndex` semantics, rejecting negative or
unsafe-integer values), `JS_ToUint32`. `JS_ToBool` is different: it never
fails (a direct spec `ToBoolean`), so it's used directly in `if (...)`,
no error check needed.

For a pointer- or `JSValue`-returning API (`JS_GetArrayBuffer`,
`JS_ReadObject`, `JS_WriteObject`, ...), the equivalent idiom is "NULL or
`JS_EXCEPTION` means it already threw, propagate it":

```c
uint8_t *buf = JS_GetArrayBuffer(ctx, &size, argv[0]);
if (!buf)
  return JS_EXCEPTION;
```

Add your own domain-specific validation (bounds checks, etc) with
`JS_ThrowRangeError`/`JS_ThrowTypeError`/`JS_ThrowInternalError` (all
`printf`-style, and themselves return `JS_EXCEPTION`, so
`return JS_ThrowRangeError(ctx, "bad index %d", i);` is the idiomatic
one-liner) where the lower-level API doesn't already check what you need.

## 2. `argc`/`argv` bounds safety

**Never read `argv[i]` for `i >= argc`.** A JS call site is free to pass
fewer arguments than a function's declared arity, and relying on the
engine having "padded" `argv[]` with extra `undefined` slots up to that
declared length is relying on an implementation detail, not a guarantee
in `quickjs.h`'s own contract. Always guard every optional-argument read
with an explicit `argc >` check, the same way every example in this
skill already does (`if (argc > 1) JS_ToInt32(ctx, &y, argv[1]);`) -
never assume, never skip the check "because it's usually padded."

**This is not a hypothetical.** A real, confirmed memory-corruption bug
was found in `qjs-opencv`'s `minMaxLoc` binding (`js_cv.cpp`, filed as
`minmaxloc-argv-out-of-bounds-read` in that project's `BUGS`), which
supported 4 optional trailing callback arguments by unconditionally
reading `argv[1]` through `argv[4]` with no `argc` bound check at all:

```c
for (size_t i = 0; i < 4; i++)
  if (js_is_function(ctx, argv[i + 1]))
    JS_Call(ctx, argv[i + 1], JS_NULL, 1, &results[i]);
```

Every ordinary call site (`cv.minMaxLoc(dst)`, `argc == 1`) read past
the end of the real `argv[]` array, interpreting whatever bytes happened
to follow as a `JSValue` and potentially dereferencing them as a heap
object pointer inside `JS_IsFunction`. This is memory corruption, not
merely a wrong-value bug - it crashed with a `SIGSEGV` deep inside a
later, *unrelated* call, not at the read's own call site, which is what
made it hard to trace back. The fix is mechanical: guard each read with
`argc > int(i) + 1` before touching `argv[i + 1]`.

## 3. A native class: constructor, finalizer, opaque data

This is the canonical minimal class, from `quickjs/examples/point.c`
(a 2D point with `x`/`y` and a `norm()` method). Read this section closely
before writing any real binding, everything else in this skill builds on
it.

**Native data lives in a malloc'd struct**, attached to the JSObject as
its *opaque pointer*, not embedded inline:

```c
typedef struct {
  int x;
  int y;
} JSPointData;

static JSClassID js_point_class_id;   // one process-global ID per class
```

**Finalizer** (exact signature, note it takes the *runtime*, not a
context, since finalizers run during GC with no guaranteed live context;
it must tolerate a NULL opaque pointer, which happens if the constructor
failed before reaching `JS_SetOpaque`):

```c
static void
js_point_finalizer(JSRuntime *rt, JSValue val) {
  JSPointData *s = JS_GetOpaque(val, js_point_class_id);
  /* s can be NULL if JS_SetOpaque() was never called */
  js_free_rt(rt, s);
}
```

**Constructor** (note the second parameter is `JSValueConst new_target`,
*not* `this_val`, that's what distinguishes a constructor signature from
a plain `JSCFunction`):

```c
static JSValue
js_point_ctor(JSContext *ctx, JSValueConst new_target, int argc, JSValueConst argv[]) {
  JSPointData *s;
  JSValue obj = JS_UNDEFINED;
  JSValue proto;

  if (!(s = js_mallocz(ctx, sizeof(*s))))
    return JS_EXCEPTION;
  if (JS_ToInt32(ctx, &s->x, argv[0]))
    goto fail;
  if (JS_ToInt32(ctx, &s->y, argv[1]))
    goto fail;

  /* using new_target to get the prototype is necessary when the class is extended */
  proto = JS_GetPropertyStr(ctx, new_target, "prototype");
  if (JS_IsException(proto))
    goto fail;

  obj = JS_NewObjectProtoClass(ctx, proto, js_point_class_id);
  JS_FreeValue(ctx, proto);
  if (JS_IsException(obj))
    goto fail;

  JS_SetOpaque(obj, s);
  return obj;

fail:
  js_free(ctx, s);
  JS_FreeValue(ctx, obj);
  return JS_EXCEPTION;
}
```

**Why `new_target.prototype`, always, not a hardcoded module-level
prototype value**: this is what makes `class MyPoint extends Point {}`
work. When called via `super(...)`, `new_target` is the *derived*
constructor, so its `.prototype` (not the base class's) becomes the new
object's prototype. Every constructor in every binding surveyed follows
this pattern; treat "read `new_target.prototype`, fall back to the
module's own proto only if that lookup fails or isn't an object" as
mandatory unless you have a specific reason a class must never be
subclassed (see `qjs-nanovg`'s `Context`/`Framebuffer`, a legitimate
exception, below).

The `goto fail` pattern (malloc first, free-on-every-exit-path via one
label) is universal because the native allocation happens *before* the
JS object exists to own it via the finalizer, so every failure path after
the `js_mallocz` needs manual cleanup.

**Registration sequence** inside the module's init callback, memorize
this order:

```c
static JSClassDef js_point_class = {
  "Point",
  .finalizer = js_point_finalizer,
};

static const JSCFunctionListEntry js_point_proto_funcs[] = {
  JS_CGETSET_MAGIC_DEF("x", js_point_get_xy, js_point_set_xy, 0),
  JS_CGETSET_MAGIC_DEF("y", js_point_get_xy, js_point_set_xy, 1),
  JS_CFUNC_DEF("norm", 0, js_point_norm),
};

static int
js_point_init(JSContext *ctx, JSModuleDef *m) {
  JSValue point_proto, point_class;

  JS_NewClassID(&js_point_class_id);
  JS_NewClass(JS_GetRuntime(ctx), js_point_class_id, &js_point_class);

  point_proto = JS_NewObject(ctx);
  JS_SetPropertyFunctionList(ctx, point_proto, js_point_proto_funcs, countof(js_point_proto_funcs));

  point_class = JS_NewCFunction2(ctx, js_point_ctor, "Point", 2, JS_CFUNC_constructor, 0);
  JS_SetConstructor(ctx, point_class, point_proto);   // proto.constructor = ctor; ctor.prototype = proto
  JS_SetClassProto(ctx, js_point_class_id, point_proto);

  JS_SetModuleExport(ctx, m, "Point", point_class);
  return 0;
}
```

1. `JS_NewClassID` (once) then `JS_NewClass` register the class with the
   runtime.
2. Build a plain `JS_NewObject(ctx)` as the prototype, attach
   methods/getters via `JS_SetPropertyFunctionList`.
3. Build the constructor function object with `JS_NewCFunction2(ctx,
   ctor_fn, "Name", arity, JS_CFUNC_constructor, magic)`, the
   `JS_CFUNC_constructor` cproto is what marks it `new`-callable.
4. `JS_SetConstructor(ctx, ctor, proto)` wires `proto.constructor = ctor`
   and `ctor.prototype = proto`.
5. `JS_SetClassProto(ctx, class_id, proto)` registers the default
   prototype for the class ID globally (used when nothing better is
   supplied).
6. Export the constructor value.

Class-level (module-namespace) functions use the batch helpers
`JS_SetModuleExportList`/`JS_AddModuleExportList` over a
`JSCFunctionListEntry[]` table; a single dynamically-built value (like a
constructor) uses the singular `JS_SetModuleExport`/`JS_AddModuleExport`
instead.

**`JS_GetOpaque` vs `JS_GetOpaque2`**: use plain `JS_GetOpaque` only where
you already know the class/object are correct (e.g. inside a finalizer,
which is invoked by the GC on a known instance, and takes no `ctx` so it
can't throw anyway). Use `JS_GetOpaque2(ctx, val, class_id)` everywhere
else, including every getter/setter/method: it additionally checks the
class ID matches and throws a `TypeError` + returns NULL on mismatch,
which matters because a method can technically be called with the wrong
`this`.

## 4. `JSValue` ownership cheat-sheet

The single most common source of leaks/use-after-free/double-free across
every binding surveyed (including two real bugs already cited in this
skill: the `cvptr` smart-pointer finalizer footgun in section 9, and the
GLFW `this_val` reference-cycle leak in section 12). Every `JSValue` is
either **borrowed** (you don't own a reference, never free it, dup it
before storing it anywhere) or **owned** (you hold a +1 reference, you
must eventually free it exactly once, whether by `JS_FreeValue`, by
returning it, or by handing ownership to something else that will free
it). Know which one you're holding at all times:

| You have a `JSValue` from... | Ownership | What to do with it |
|---|---|---|
| `argv[i]`, `this_val`, `new_target` (function arguments) | **borrowed** | Never `JS_FreeValue` it. `JS_DupValue(ctx, v)` before storing it anywhere that outlives the current call. |
| `JS_GetPropertyStr`/`JS_GetProperty`/`JS_GetPropertyUint32` | **owned** (+1) | `JS_FreeValue` when done reading it, unless you're returning it or storing it (still owned, no extra dup needed). |
| `JS_NewXxx` (`JS_NewObject`, `JS_NewInt32`, `JS_NewString`, `JS_NewArray`, ...) | **owned** (+1) | Same as above. |
| `JS_NewPromiseCapability`'s `resolving_funcs[2]` | **owned** (+1 each) | Free both, unconditionally, in whichever of resolve/reject actually runs (section 14). |
| `JS_DupValue(ctx, v)` | **owned** (+1), independent of `v`'s own reference | Pairs with exactly one later `JS_FreeValue`. |
| A `JSCFunction`'s own return value | ownership transfers to the caller (the engine) | Return an owned value, `JS_UNDEFINED`, or `JS_EXCEPTION` - never a borrowed value without duping it first. |
| A value stashed in a struct/global for later use (a callback, a cached prototype) | must become **owned** at the moment of storing | `JS_DupValue` at store time if it arrived borrowed; free it in the finalizer, or the owning object's explicit teardown path, whichever actually runs. |

**Two habits that catch most mistakes:**
- On every `goto fail`/early-return error path, free everything acquired
  *so far* in that function - an error path is exactly where a dup or
  malloc is easiest to forget to unwind (see the `goto fail` pattern in
  section 3).
- `JS_FreeValue(ctx, JS_UNDEFINED)`/`JS_FreeValue(ctx, JS_NULL)` are
  always safe no-ops, so a defensive free never has to be conditioned on
  "did I actually get a real value here" - but freeing the *same* real
  owned reference twice (double-free) or never freeing one you own (leak)
  are both real bugs; there's no such thing as a harmless extra free of
  a value you don't actually own.

## 5. Magic-indexed dispatch: collapsing N accessors into one function

`JS_CGETSET_MAGIC_DEF(name, getter, setter, magic)` and
`JS_CFUNC_MAGIC_DEF(name, length, func, magic)` let one C function serve
many JS-visible properties/methods, dispatched on an `int magic` passed
alongside the normal arguments:

```c
static JSValue
js_point_get_xy(JSContext *ctx, JSValueConst this_val, int magic) {
  JSPointData *s = JS_GetOpaque2(ctx, this_val, js_point_class_id);
  if (!s) return JS_EXCEPTION;
  return JS_NewInt32(ctx, magic == 0 ? s->x : s->y);
}
```

This is the dominant idiom across every binding surveyed, not just for
trivial x/y pairs. `qjs-nanovg`'s `Transform` (a 6-float matrix) maps
**two different naming conventions** (canvas-style `a,b,c,d,e,f` and
matrix-style `xx,yx,xy,yy,x0,y0`) onto the *same* magic values, so
callers can use either vocabulary against identical underlying slots.
`qjs-nanovg`'s `Transform.Translate`/`Scale`/`Rotate`/... mutator methods
are all one function switching on a `TRANSFORM_*` enum magic. Prefer this
over N separate near-identical functions whenever properties/methods
share a body shape; it's both less code and (for a `switch`-based body)
lets the compiler emit a jump table.

`qjs-sound`'s STK binding pushes magic dispatch further: an entire
**constructor** can be shared across many JS-visible class names via
`JS_CFUNC_constructor_magic` (see section 9 below), one C switch-case per
concrete C++ type.

## 6. Lightweight struct-by-value "classes": don't always reach for JSClassID

Not everything needs an opaque-pointer class. Two different, both
legitimate, lighter alternatives, pick based on what the native data
actually needs:

**Duck-typed array-or-object conversion at the call boundary** (best for
a struct passed *by value* into/out of many C calls per frame, e.g.
`ImVec2`/`ImVec4` in `qjs-imgui`): no class, no finalizer, no allocation
beyond a temporary. Accept whichever shape the caller naturally reaches
for:

```c
static ImVec2
js_imgui_getimvec2(JSContext *ctx, JSValueConst value) {
  JSValue xval = JS_UNDEFINED, yval = JS_UNDEFINED;
  double x, y;
  if (JS_IsArray(ctx, value)) {
    xval = JS_GetPropertyUint32(ctx, value, 0);
    yval = JS_GetPropertyUint32(ctx, value, 1);
  } else if (JS_IsObject(value)) {
    xval = JS_GetPropertyStr(ctx, value, "x");
    yval = JS_GetPropertyStr(ctx, value, "y");
  }
  JS_ToFloat64(ctx, &x, xval);
  JS_ToFloat64(ctx, &y, yval);
  return ImVec2(x, y);
}
```
Return the same struct as a plain `[x, y]` array on the way back out.
(`qjs-imgui`'s own name for this predates the convention below; for new
code, name this direction `js_<typename>_fromobj` per section 17.)
`qjs-imgui`'s color helper goes further, accepting an `{r,g,b,a}`-shaped
object/array, a packed `0xRRGGBBAA` number, *or* a hex string, in one
function. A heavyweight `JSClassDef` wrapper for something copied by
value dozens of times per frame just adds GC pressure for no benefit.

**Splice the prototype onto a real `Float32Array`** (best for a small,
fixed-size POD float vector that needs elementwise numeric access *and*
zero-copy interop as a native `float[]` argument, e.g. `qjs-nanovg`'s
`Color`/`Transform`): no `JSClassID`/`JS_NewClass` at all, just a plain
object whose prototype chain is spliced onto `Float32Array.prototype`:

```c
JSValue global = JS_GetGlobalObject(ctx);
JSValue f32_ctor = JS_GetPropertyStr(ctx, global, "Float32Array");
JSValue f32_proto = JS_GetPropertyStr(ctx, f32_ctor, "prototype");
JS_FreeValue(ctx, global);

color_proto = JS_NewObjectProto(ctx, f32_proto);
JS_SetPropertyFunctionList(ctx, color_proto, nvgjs_color_methods, countof(nvgjs_color_methods));
color_ctor = JS_NewObjectProto(ctx, JS_NULL);
JS_SetConstructor(ctx, color_ctor, color_proto);
```
with named accessors that are trivial forwards to indexed access, since
`magic` is literally the typed-array slot:
```c
static JSValue
nvgjs_color_get(JSContext *ctx, JSValueConst this_val, int magic) {
  return JS_GetPropertyUint32(ctx, this_val, magic);
}
```
Nothing to finalize either, the real `ArrayBuffer` backing the
`Float32Array` is GC'd normally.

**Rule of thumb**: reach for a real `JSClassID`/opaque-pointer class only
when the native data is a resource (a handle, a native pointer with
identity/lifetime, something that must not be silently copied). For a
small POD value type, prefer one of the two lighter patterns above.

## 7. Typed array / ArrayBuffer interop

**Mental model first**: an `ArrayBuffer` is just a raw byte allocation
with no type and no shape. `TypedArray` (`Uint8Array`, `Float32Array`,
...) and `DataView` are both *views* onto one, neither owns memory of its
own. Every view carries the same two extra numbers on top of whichever
`ArrayBuffer` backs it: a byte **offset** (where the view starts inside
that buffer, not necessarily 0) and a **length** (how many
elements/bytes the view spans, not necessarily the whole rest of the
buffer). Treat `TypedArray`/`DataView` as one concept, "a `(buffer,
offset, length)` triple with a type tag," not as two unrelated things,
the binding code for extracting the backing pointer is identical for
both (`JS_GetTypedArrayBuffer` works on a `DataView` the same way it does
on any `TypedArray`).

This is also why a C API taking buffer arguments comes in one of two
equally common JS-facing shapes, and a binding should pick deliberately,
not by accident:
- **`fn(arrayBuffer, offset, length)`**, three separate JS arguments,
  mirrors a raw-pointer-and-length C signature most directly. Read the
  buffer with `JS_GetArrayBuffer`, then apply the caller-supplied
  offset/length yourself (with bounds checking, see below), since
  `JS_GetArrayBuffer` doesn't know about them at all.
- **`fn(arrayView)`**, one JS argument, a `TypedArray`/`DataView` the
  caller already sliced to the right region. Read it with
  `JS_GetTypedArrayBuffer`, which hands back the view's *own*
  offset/length already resolved, so you don't ask the caller to repeat
  them by hand and can't get them out of sync with the view. Prefer this
  shape for a new binding whenever the underlying C API takes a single
  `(ptr, len)` pair, it's less error-prone for the caller and matches
  how JS code naturally slices buffers (`buf.subarray(a, b)`).

Both shapes end up needing the same underlying calls, just fed from
different arguments:

**Reading a buffer's raw bytes (the `(arrayBuffer, offset, length)` shape):**
```c
uint8_t *buf = JS_GetArrayBuffer(ctx, &size, argv[0]);   // NULL on failure, already thrown
```
**Reading a view's backing store (the `(arrayView)` shape), respecting
its own offset/length** (works identically for a `TypedArray` or a
`DataView`, both are views; a view can point into a larger/shared
`ArrayBuffer`, so it does not necessarily start at byte 0 or span the
whole buffer):
```c
size_t offset, byte_length, bytes_per_element;
JSValue buf = JS_GetTypedArrayBuffer(ctx, obj, &offset, &byte_length, &bytes_per_element);
uint8_t *ptr = JS_GetArrayBuffer(ctx, &byte_length, buf);
if (ptr) ptr += offset;   // the +offset is required, don't skip it
```
**Copying data into a fresh ArrayBuffer:**
```c
JSValue array = JS_NewArrayBufferCopy(ctx, buf, len);
```
**Handing a natively-allocated buffer to JS *without* copying**, so
QuickJS's GC frees the native memory when the ArrayBuffer dies:
```c
void *image = js_malloc(ctx, w * h * 4);
/* ... fill image ... */
return JS_NewArrayBuffer(ctx, image, w * h * 4, my_arraybuffer_free, NULL, FALSE);
```
with a trivial free callback:
```c
static void
my_arraybuffer_free(JSRuntime *rt, void *opaque, void *ptr) {
  js_free_rt(rt, ptr);
}
```

**Manual bounds checking is your job.** None of the `JS_Get*Buffer`
functions bounds-check any offset/length you subsequently apply:
```c
if (pos + len > size)
  return JS_ThrowRangeError(ctx, "array buffer overflow");
```

**The "probe, discard exception, try next" idiom** for accepting several
input shapes from one call site (from `qjs-nanovg`, used pervasively for
"give me N floats from whatever the caller passed", trying a typed array,
then a plain iterable, then a named-property object, in order): call a
strict-typed helper as a probe; if it throws, explicitly clear the
exception before trying the next fallback, so a later *successful*
fallback doesn't leave a stale pending exception:

```c
/* Not a Float32Array, clear the probe TypeError before trying fallbacks */
JS_FreeValue(ctx, JS_GetException(ctx));
```

This isn't documented anywhere in the QuickJS headers, it's inferred
from `JS_GetException`'s side effect of clearing the pending-exception
flag, but it's the cleanest known way to do multi-shape argument coercion
without a maze of manual type checks.

**Serialization (`tests/bjson.c`)**: `JS_ReadObject(ctx, buf, len, flags)`
/ `JS_WriteObject(ctx, &len, value, flags)` do full structured-clone-style
(de)serialization, with `JS_READ_OBJ_REFERENCE`/`JS_WRITE_OBJ_REFERENCE`
flags controlling whether circular/shared references are permitted. Same
NULL/`JS_EXCEPTION`-propagation idiom as everything else.

## 8. When conversion logic outgrows the binding file: an auxiliary `utils.[ch]` pair

Section 7's helpers (typed-array probing, the multi-shape input idiom) are
shown inline above because they're a handful of functions. Once a binding
has to accept *many* different C-visible types through *many* different
JS-visible shapes, that conversion logic stops being a handful of
functions and starts drowning out the actual binding code (the
`JS_CFUNC_DEF` tables, the class registration). Every mature binding
surveyed hits this and responds the same way: split the conversion layer
into its own `utils.c`/`utils.h` (or `js-utils.c`/`js-utils.h`) pair,
kept separate from the file that defines the JS classes/functions
themselves.

**The recurring shape**: a small set of "resolver" functions, each taking
a `JSValueConst` and a `JSContext*`, each trying several JS-visible input
shapes in priority order (typed array/zero-copy alias first, then a
plain array, then an iterable, then a named-property object, ...) and
returning one canonical C/C++ value the rest of the binding can use
without caring which shape the caller actually passed. This is precisely
what OpenCV's own `cv::_InputArray`/`cv::_OutputArray`/`cv::_InputOutputArray`
do on the C++ side (duck-typed sinks that accept a `Mat`, a `vector<T>`,
a `Scalar`, ... uniformly) - a binding's `utils.[ch]` pair is doing the
same job one layer up, at the JS/C boundary instead of the C++ type
boundary. `qjs-opencv` makes the parallel explicit by naming its own
version of this after OpenCV's concept directly:

- **`qjs-opencv/include/js_inputoutputarray.hpp`** - `js_cv_inputarray()`,
  `js_cv_inputoutputarray()`, `js_cv_outputarray()` resolve a JS value
  (a `Mat`/`UMat` wrapper, a `JSVector<T>`, an `ArrayBuffer`, a
  `TypedArray`, or a plain JS array/`Scalar`-shaped array) to a
  `cv::_InputArray`/`_OutputArray`/`_InputOutputArray` with zero-copy
  aliasing wherever the JS-side memory layout allows it, only falling
  back to an owned `std::vector<T>` when it doesn't (`js_argument_array<T,
  ArrayT>`, same file). The output-array side even hands results back
  through three different JS-visible receivers (a raw `TypedArray`, a
  `JSVector<T>`, or a plain array copy) depending what the caller passed
  in and what `T` supports - see `JSOutputArrayOf<T>`'s destructor,
  same file. Other `js*.hpp`/`js*.cpp` files across `qjs-opencv` (not
  just this one) follow the same "helpers live in their own header/source
  pair, separate from the class/function that uses them" split, e.g.
  `js_array.hpp` (plain-JS-array conversions) and `js_typed_array.hpp`
  (`TypedArrayProps`, dtype dispatch) - `js_inputoutputarray.hpp` builds
  directly on both.
- **`qjs-nanovg/nvgjs-utils.{c,h}`** - `nvgjs_inputoutputarray()`,
  `nvgjs_inputarray()`, `nvgjs_inputiterator()`, `nvgjs_inputobject()`,
  `nvgjs_input()` resolve a JS value to a `float[]` the same way: try a
  `Float32Array` (zero-copy pointer into its backing store) first, then a
  plain `Array`, then any iterable, then (if a `prop_map` of names like
  `{"x","y"}` is supplied) named object properties - see
  `nvgjs_inputoutputarray()` and `nvgjs_input()`,
  `qjs-nanovg/nvgjs-utils.c`. `nvgjs_copyobject()`/`nvgjs_copyarray()`
  are the write-back inverse. This is the "probe, discard exception, try
  next" idiom from section 7, factored out of the ~30 call sites in
  `quickjs-nanovg.c` that would otherwise each hand-roll it.
- **`qjs-lws/js-utils.{c,h}`** - a broader grab-bag, still one pair:
  `get_buffer()`/`get_typedarray_buffer()`/`get_offset_length()` do the
  `(TypedArray | DataView | ArrayBuffer, offset?, length?)` resolution
  from section 7 once, centrally, instead of per call site;
  `to_valuearray()`/`to_stringarray()` drain any iterable into a C array;
  `js_has_property()`/`js_get_property()` add a snake_case/camelCase
  fallback (needed because lws's own option structs are field-named in
  snake_case but JS callers commonly write camelCase - see the comment
  above `js_has_property()`, same file, and the `option-key-casing-
  silently-ignored` entry in that project's `BUGS`) so option-object
  parsing across the whole binding stays consistent without every call
  site repeating the fallback by hand.
- **`qjs-modules/{include,src}/*-utils.{h,c}`** - the same pattern taken
  a step further: instead of one grab-bag pair, the conversion/utility
  layer is split into several *themed* `utils.[ch]` pairs living
  alongside each other - `js-utils.{h,c}` (Promise plumbing:
  `promise_create`/`promise_resolve`/`promise_forward`), `buffer-
  utils.{h,c}` (`DynBuf` helpers - growable-buffer building, escaping,
  encoding), `char-utils.{h,c}`, `stream-utils.{h,c}`. Once a single
  `utils.[ch]` pair itself gets large, splitting *by theme* (what the
  helpers are about) rather than leaving one sprawling file is the same
  underlying instinct one level up.

**When to reach for this pattern**: not from the start (a small binding's
few conversion helpers belong right next to the code that uses them, as
in section 7). Split them out once either becomes true:
- the same "accept several JS shapes, resolve to one C value" resolver
  is called from more than a couple of `JS_CFUNC_DEF` bodies, i.e. it's
  genuinely shared, not local to one function; or
- the binding file's line count is dominated by conversion plumbing
  rather than by the actual class/function definitions the module
  exports, making it hard to find the latter.

Name the pair to match the project's existing convention if one already
exists (`<prefix>-utils.c`/`.h`, `js-utils.c`/`.h`, ...); don't invent a
third naming style in a project that already has one. For a from-scratch
module with no established convention, `<module>-utils.c`/`.h` (matching
`qjs-nanovg`'s `nvgjs-utils.{c,h}`) or plain `js-utils.c`/`.h` (matching
`qjs-lws`) are both fine defaults - ask if genuinely unsure which reads
better for the target project.

## 9. Wrapping a C++ class hierarchy / virtual base classes

**This is the question `JS_GetOpaque`/`JS_SetOpaque` don't answer for
you**: they take exactly one `void*` and are keyed by exactly one
`JSClassID` per object. A C++ library with real inheritance (an abstract
base, many concrete subclasses) needs a deliberate strategy on top. Three
real, different, all-legitimate strategies were found across the
surveyed codebases. **Pick based on how much JS-visible API/state
diverges between subclasses**, not by default habit:

### Strategy A: one `JSClassID` per hierarchy *level*, magic-dispatched constructor (STK)

Use when subclasses differ **only in behavior through virtual dispatch**,
i.e. every concrete type exposes the exact same JS-visible method set as
the base (e.g. every STK filter just has `tick()`; nothing subclass-specific
leaks into JS). Collapse the whole level to one class ID:

```cpp
typedef std::shared_ptr<stk::Filter> StkFilterPtr;   // one typedef per hierarchy LEVEL, not per leaf

static JSValue
js_stkfilter_constructor(JSContext *ctx, JSValueConst new_target, int argc, JSValueConst argv[], int magic) {
  StkFilterPtr *f = static_cast<StkFilterPtr*>(js_mallocz(ctx, sizeof(StkFilterPtr)));

  switch (magic) {
    case INSTANCE_BIQUAD:   *f = std::make_shared<stk::BiQuad>();  break;
    case INSTANCE_TWO_POLE: *f = std::make_shared<stk::TwoPole>(); break;
    case INSTANCE_TWO_ZERO: *f = std::make_shared<stk::TwoZero>(); break;
    /* ... one line per concrete C++ type ... */
  }

  JSValue proto = JS_GetPropertyStr(ctx, new_target, "prototype");
  /* ... fall back to stkfilter_proto if not an object, same as section 3 ... */
  JSValue obj = JS_NewObjectProtoClass(ctx, proto, js_stkfilter_class_id);  // SAME class id every case
  JS_FreeValue(ctx, proto);
  JS_SetOpaque(obj, f);
  js_set_tostringtag(ctx, obj, name_table[magic]);   // JS-visible identity, without a distinct class
  return obj;
}
```
Registered as N distinct JS constructor *functions* (`BiQuad`, `TwoPole`,
`TwoZero`, ...), each with a different `magic`, all sharing one C function
via `JS_CFUNC_constructor_magic` and one prototype (`stkfilter_proto`).
`instanceof` can't distinguish `BiQuad` from `TwoPole`, only
`[Symbol.toStringTag]` (set per-instance from a magic-indexed name table)
tells them apart on the JS side. Methods on the shared prototype just
call through the base pointer: `(*f)->tick(...)`, virtual dispatch does
the rest, **no per-leaf branching needed in the binding at all**.

Finalizer is per-level (not per-leaf), placement-destroys the
`shared_ptr` before freeing the block, this is what actually runs the
C++ virtual destructor (through the base class's own virtual dtor,
required since STK's classes declare one):
```cpp
static void
js_stkfilter_finalizer(JSRuntime *rt, JSValue val) {
  StkFilterPtr *f = static_cast<StkFilterPtr*>(JS_GetOpaque(val, js_stkfilter_class_id));
  if (f) {
    f->~StkFilterPtr();      // runs shared_ptr's own refcount teardown -> derived dtor -> delete
    js_free_rt(rt, f);
  }
}
```

### Strategy B: one `JSClassID` per concrete leaf, real `JS_SetPrototype` chain (LabSound)

Use when subclasses genuinely **diverge in JS-visible properties/methods**
(e.g. `OscillatorNode.frequency`/`.detune`/`.type` vs `GainNode.gain` vs
`BiquadFilterNode.type`/`.frequency`/`.Q`, real per-type API surface).
Give each leaf type its own class ID and prototype, then wire the
prototypes together with `JS_SetPrototype` to mirror the C++ hierarchy,
so shared base methods (`connect`/`disconnect`/`start`/`stop`) live once
on an intermediate, classless prototype:

```cpp
audionode_proto = JS_NewObject(ctx);   // no JSClassID, not constructible: exists only to hold shared methods
JS_SetPropertyFunctionList(ctx, audionode_proto, js_audionode_funcs, countof(js_audionode_funcs));

audioscheduledsourcenode_proto = JS_NewObject(ctx);
JS_SetPropertyFunctionList(ctx, audioscheduledsourcenode_proto, js_audioscheduledsourcenode_funcs, countof(...));
JS_SetPrototype(ctx, audioscheduledsourcenode_proto, audionode_proto);   // mirrors C++ ancestry

JS_NewClassID(&js_oscillatornode_class_id);
JS_NewClass(JS_GetRuntime(ctx), js_oscillatornode_class_id, &js_oscillatornode_class);
oscillatornode_proto = JS_NewObject(ctx);
JS_SetPrototype(ctx, oscillatornode_proto, audioscheduledsourcenode_proto);
JS_SetPropertyFunctionList(ctx, oscillatornode_proto, js_oscillatornode_funcs, countof(js_oscillatornode_funcs));
JS_SetClassProto(ctx, js_oscillatornode_class_id, oscillatornode_proto);
```
Resulting chain: `oscillatornode_proto -> audioscheduledsourcenode_proto
-> audionode_proto -> Object.prototype`. Now `instanceof`/method
inheritance genuinely line up with the C++ hierarchy.

Opaque data is a small wrapper struct, not a bare pointer, because
LabSound's nodes need to keep their owning context alive too:
```cpp
struct JsAudioNode {
  std::shared_ptr<lab::AudioNode> node;
  AudioContextPtr ctx;   // owning ref back to the parent, keeps it alive as long as any node holds it
};
```
Each leaf constructor is its own separate `JS_CFUNC_constructor`
(no magic needed here, since each already has its own class ID and
constructor function), sharing only a small helper that builds the
opaque block and wraps it:
```cpp
static JSValue
make_audio_node_js(JSContext *ctx, JSValueConst proto, JSClassID class_id,
                    std::shared_ptr<lab::AudioNode> node, AudioContextPtr ac) {
  auto *w = static_cast<JsAudioNode*>(js_mallocz(ctx, sizeof(JsAudioNode)));
  new (w) JsAudioNode{std::move(node), std::move(ac)};
  JSValue obj = JS_NewObjectProtoClass(ctx, proto, class_id);
  if (JS_IsException(obj)) { w->~JsAudioNode(); js_free(ctx, w); return obj; }
  JS_SetOpaque(obj, w);
  return obj;
}
```
and finalizers are one-line forwarders to a shared helper parameterized
by class ID:
```cpp
static void js_oscillatornode_finalizer(JSRuntime *rt, JSValue val) {
  js_audionode_finalize_with(rt, val, js_oscillatornode_class_id);
}
```

**The real cost of this strategy**: since each leaf owns a distinct class
ID, `JS_GetOpaque` alone can't fetch "any AudioNode" generically (there's
no class ID for the abstract base to check against). A function that must
accept any node type (e.g. `connect(dest)`) needs a manual linear probe
across every known concrete class ID:
```cpp
static JsAudioNode*
any_audio_node(JSValueConst v) {
  void *p;
  if ((p = JS_GetOpaque(v, js_oscillatornode_class_id))) return (JsAudioNode*)p;
  if ((p = JS_GetOpaque(v, js_gainnode_class_id)))       return (JsAudioNode*)p;
  if ((p = JS_GetOpaque(v, js_biquadfilternode_class_id))) return (JsAudioNode*)p;
  /* ... one line per remaining leaf class id ... */
  return nullptr;
}
```
Strategy A never needs this, since one class ID already covers every
subclass at that level by construction. This probe function is the price
Strategy B pays for genuinely per-leaf JS API surfaces.

### Strategy C: one `JSClassID` per *family*, opaque payload is the smart pointer itself (qjs-opencv)

A third answer, used when the underlying library already has a
type-erasing smart pointer (`cv::Ptr<T>`, OpenCV's `shared_ptr`-alike):
group many unrelated concrete leaf types (ORB, SIFT, AKAZE, BRISK, ...
every `cv::Feature2D` subclass) under **one shared class ID**, but store
`cv::Ptr<Base>` as the opaque payload, constructed through a small
*template* wrap helper parameterized on the real leaf type:

```cpp
typedef cv::Ptr<cv::Feature2D> JSFeature2DData;   // storage type is always the BASE

template<class T>
JSValue
js_feature2d_wrap(JSContext *ctx, const cv::Ptr<T> &f2d) {
  cv::Ptr<T> *s = js_allocate<cv::Ptr<T>>(ctx);   // sized off sizeof(cv::Ptr<T>), same layout for every T
  *s = f2d;
  JSValue ret = JS_NewObjectProtoClass(ctx, feature2d_proto, js_feature2d_class_id);
  JS_SetOpaque(ret, s);
  return ret;
}
```
This works because `cv::Ptr<T>` has an identical, `T`-independent memory
layout (a pointer to `T` plus a pointer to a type-erased control block
that knows how to destroy the real object) for any `T`. The opaque slot
is read back everywhere as `cv::Ptr<Base>*`; C++ virtual dispatch through
the base pointer handles most calls, and `dynamic_cast<T*>` handles the
rare leaf-specific method:
```cpp
template<class T>
T*
js_feature2d_get(JSValueConst val) {
  JSFeature2DData *f2d = static_cast<JSFeature2DData*>(JS_GetOpaque(val, js_feature2d_class_id));
  return f2d ? dynamic_cast<T*>(f2d->get()) : nullptr;
}
```
Finalizer just placement-destroys the smart pointer (`s->~JSFeature2DData()`),
which releases the shared reference and, on last release, invokes the
type-erased deleter, the same "let the smart pointer's own bookkeeping do
it" idea as Strategy A's `shared_ptr` teardown. `instanceof` doesn't
distinguish leaf types here either (no `JS_SetPrototype` chain); leaf
identity is conveyed only via a per-instance `Symbol.toStringTag` set at
construction (`js_object_tostringtag(ctx, ret, "ORB")`), same trick as
Strategy A.

**A finalizer footgun seen in this exact codebase, worth avoiding**: some
finalizers in the same project destroy through a raw/`dynamic_cast`
pointer instead of the smart pointer itself (`(*s)->~ConcreteType()`
instead of `s->~JSFeature2DData()`). That still dispatches virtually to
the right destructor *body*, but skips the smart pointer's own
refcount/release/deallocation bookkeeping entirely, only the two together
are "correct." If you're storing a smart pointer as the opaque payload,
destroy the *smart pointer*, not the pointee. This isn't a one-off: a
full audit of `qjs-opencv`'s 49 finalizers found **9** doing this (filed
as `cvptr-finalizer-bypasses-refcount-release` in that project's `BUGS`)
- always worth a quick grep (`)->~`, plus any `dynamic_cast`-then-destroy
chain) across every finalizer in a `cv::Ptr`-style codebase before
trusting any single one of them as a template.

### Decision table

| Subclasses diverge... | Strategy | Class IDs | `instanceof` matches leaf type? | Extra cost |
|---|---|---|---|---|
| only in virtual-dispatch *behavior*, identical JS API | A (STK) | one per hierarchy level | no, only `toStringTag` | none, `constructor_magic` switch |
| in real JS-visible properties/methods per leaf | B (LabSound) | one per leaf | yes, real prototype chain | linear-probe helper for "any subclass" arguments |
| library already has a type-erasing smart pointer | C (qjs-opencv) | one per family | no, only `toStringTag` | template wrap helper per leaf construction site |

In all three, the opaque block is **placement-constructed in raw
`js_mallocz` memory (never plain C++ `new`)** and torn down with an
**explicit destructor call before `js_free_rt`**. That explicit dtor call
is the actual mechanism that safely runs a C++ (possibly virtual)
destructor without QuickJS needing to know anything about C++ object
layout; never rely on `js_free_rt` alone to destroy a non-POD C++ object.

## 10. Exotic classes: live/computed properties, not ahead-of-time

`JSClassExoticMethods` (a field on `JSClassDef`) lets a class implement
its own `[[GetOwnProperty]]`/`[[OwnPropertyKeys]]` (and, more rarely,
`[[HasProperty]]`/`[[DefineOwnProperty]]`/`[[Delete]]`/`[[Get]]`/`[[Set]]`)
traps instead of relying on a fixed, ahead-of-time
`JSCFunctionListEntry[]` table. **Reach for this only when a real
property list is impractical**, an unbounded or externally-owned index
space (a live device list, a dynamic collection with no fixed size known
at class-registration time), not merely because a class has "a lot" of
properties.

```c
typedef struct JSClassExoticMethods {
  int (*get_own_property)(JSContext *ctx, JSPropertyDescriptor *desc, JSValueConst obj, JSAtom prop);
  int (*get_own_property_names)(JSContext *ctx, JSPropertyEnum **ptab, uint32_t *plen, JSValueConst obj);
  int (*delete_property)(JSContext *ctx, JSValueConst obj, JSAtom prop);
  int (*define_own_property)(JSContext *ctx, JSValueConst this_obj, JSAtom prop, JSValueConst val, JSValueConst getter, JSValueConst setter, int flags);
  /* the rest can usually be emulated by the above, and are usually left NULL */
  int (*has_property)(JSContext *ctx, JSValueConst obj, JSAtom atom);
  JSValue (*get_property)(JSContext *ctx, JSValueConst obj, JSAtom atom, JSValueConst receiver);
  int (*set_property)(JSContext *ctx, JSValueConst obj, JSAtom atom, JSValueConst value, JSValueConst receiver, int flags);
} JSClassExoticMethods;
```

Worked example (`qjs-sound`'s `PaDevices`, a live array-like view over
`Pa_GetDeviceInfo()`, no materialized properties, no opaque data at all,
a fresh wrapper object is built on every read):

```c
static BOOL
js_padevices_get_own_property(JSContext *ctx, JSPropertyDescriptor *pdesc, JSValueConst obj, JSAtom prop) {
  if (prop & (1 << 31)) {   // QuickJS's convention: integer atoms carry the sign bit set
    int32_t index = prop & ~(1 << 31);
    PaDeviceInfo *info = Pa_GetDeviceInfo(index);
    if (info && pdesc) {
      pdesc->flags = JS_PROP_ENUMERABLE;
      pdesc->value = js_padeviceinfo_wrap(ctx, padeviceinfo_proto, *info);
      pdesc->getter = JS_UNDEFINED;
      pdesc->setter = JS_UNDEFINED;
    }
    return info != NULL;
  }
  const char *key = JS_AtomToCString(ctx, prop);
  BOOL ret = FALSE;
  if (key && !strcmp(key, "length")) {
    if (pdesc) {
      pdesc->flags = JS_PROP_ENUMERABLE;
      pdesc->value = JS_NewUint32(ctx, Pa_GetDeviceCount());
    }
    ret = TRUE;
  }
  JS_FreeCString(ctx, key);
  return ret;
}

static int
js_padevices_get_own_property_names(JSContext *ctx, JSPropertyEnum **ptab, uint32_t *plen, JSValueConst obj) {
  uint32_t len = Pa_GetDeviceCount();
  JSPropertyEnum *props = js_malloc(ctx, sizeof(JSPropertyEnum) * len);
  if (props) {
    for (uint32_t i = 0; i < len; i++) {
      props[i].is_enumerable = TRUE;
      props[i].atom = JS_NewAtomUInt32(ctx, i);
    }
    *ptab = props;
    *plen = len;
  }
  return 0;
}

static JSClassExoticMethods js_padevices_exotic_methods = {
  .get_own_property = js_padevices_get_own_property,
  .get_own_property_names = js_padevices_get_own_property_names,
};

static JSClassDef js_padevices_class = {
  .class_name = "PaDevices",
  .finalizer = js_padevices_finalizer,
  .exotic = &js_padevices_exotic_methods,
};
```
Only implement the traps you actually need, leave the rest NULL (QuickJS
falls back to default behavior). This is a narrow, special-purpose tool;
even codebases with plenty of "expose a live external collection"
opportunities (LabSound's own node list) mostly reach for a plain mutable
JS array instead, that's the right default. Exotic methods earn their
complexity only for a genuinely dynamic/external index space.

## 11. Enum/constant export at scale

For a handful of constants, `JS_PROP_INT32_DEF(name, value, flags)` /
`JS_PROP_INT64_DEF` / `JS_PROP_DOUBLE_DEF` as rows in the same
`JSCFunctionListEntry[]` table as your functions is enough. Wrap it in a
one-line macro so each constant is a single declarative row:
```c
#define MY_FLAG(name) JS_PROP_INT32_DEF(#name, MYLIB_##name, JS_PROP_CONFIGURABLE | JS_PROP_ENUMERABLE)
/* ... */
MY_FLAG(ANTIALIAS),
MY_FLAG(STENCIL_STROKES),
```

For **hundreds** of constants that naturally group into namespaces (e.g.
ImGui's `WindowFlags`, `InputTextFlags`, `TreeNodeFlags`, dozens of such
groups), don't hand-write a `JS_NewObject` + loop per group. QuickJS's
`JS_OBJECT_DEF` entry type builds and populates a sub-object declaratively,
right inside the top-level function list:
```c
#define JS_PROP_CONSTANT(name, value) JS_PROP_INT64_DEF(name, value, JS_PROP_ENUMERABLE)

static const JSCFunctionListEntry js_window_flags[] = {
  JS_PROP_CONSTANT("NoTitleBar", ImGuiWindowFlags_NoTitleBar),
  /* ... */
};

/* in the module's own top-level function list: */
JS_OBJECT_DEF("WindowFlags", js_window_flags, countof(js_window_flags), JS_PROP_ENUMERABLE),
```
A single `JS_SetPropertyFunctionList` call at module-init time
recursively creates and populates every `JS_OBJECT_DEF` sub-object.
Result: `mylib.WindowFlags.NoTitleBar` etc, all "just work" with zero
custom object-building code. Reach for `JS_OBJECT_DEF` before writing a
manual per-namespace loop.

## 12. Calling JS from a C callback

The C library calling back into your binding asynchronously (a key
callback, a resize callback, an async I/O completion) is the pattern
requiring the most care around object lifetime.

**Register/unregister the real C callback as a side effect of a JS
property setter**, and skip the trampoline entirely when nobody is
listening (`qjs-glfw`):

```c
static JSValue
glfw_window_set_callback(JSContext *ctx, JSValueConst this_val, JSValueConst value, int magic) {
  WindowContext *wc = glfwGetWindowUserPointer(window);
  if (!JS_IsUndefined(wc->handlers.list[magic]))
    JS_FreeValue(ctx, wc->handlers.list[magic]);
  wc->handlers.list[magic] = JS_DupValue(ctx, value);
  BOOL enable = JS_IsFunction(ctx, wc->handlers.list[magic]);
  switch (magic) {
    case CALLBACK_KEY:
      glfwSetKeyCallback(window, enable ? &glfw_handle_key : NULL);
      break;
    /* ... */
  }
  return JS_NewBool(ctx, enable);
}
```
Setting the property to `null`/a non-function unregisters the C-level
callback (`enable ? &fn : NULL`), rather than leaving a dead trampoline
installed and paying per-event dispatch overhead for nothing.

The trampoline itself looks the stored `JSValue` back up (via whatever
user-pointer mechanism the C library provides) and calls it:
```c
static void
glfw_handle_key(GLFWwindow *w, int key, int scancode, int action, int mods) {
  WindowContext *wc = glfwGetWindowUserPointer(w);
  JSValueConst args[] = {
    JS_NewInt32(wc->ctx, key), JS_NewInt32(wc->ctx, scancode),
    JS_NewInt32(wc->ctx, action), JS_NewInt32(wc->ctx, mods),
  };
  JS_Call(wc->ctx, wc->handlers.list[CALLBACK_KEY], wc->this_val, 4, args);
}
```

**Gotcha, confirmed as a real bug in the codebase this was drawn from**:
if a struct owned by the C library (not by QuickJS's GC) holds a
`JS_DupValue`'d reference back to the very JS object it's attached to
(`wc->this_val = JS_DupValue(ctx, obj)`, so the trampoline has a `this`
to call with), and the class has **no finalizer that drops that
reference**, the JS object can never reach refcount 0 through normal GC.
This is a real reference-cycle-through-native-memory leak. **Any
`this_val`/callback `JSValue` stashed in a struct external to QuickJS's
own object graph must be dropped somewhere**: in `JSClassDef.finalizer`,
or in the owning C object's own explicit destroy path, or it pins the JS
object forever.

If the C library supports polling instead of callbacks (check first),
skip the whole callback-bridge machinery, `qjs-rgfw` never calls
`JS_Call`/`JS_DupValue` anywhere, it's purely "JS calls in to check
events."

## 13. Realtime/audio-thread callbacks: never call into JS from another OS thread

**Everything in section 12 assumes the C library's callback fires on the
same OS thread that's running the `JSContext`.** That's true for GLFW's
event callbacks (they only fire during `glfwPollEvents()`, called from
JS). It is **not** true for every C library with a callback API - a
realtime audio callback (PortAudio's stream callback, an ALSA/JACK
process callback, a hardware IRQ handler, any library-owned worker
thread) typically fires on a **separate thread the library itself
created and controls**. QuickJS is not thread-safe: calling `JS_Call`,
`JS_NewXxx`, or `JS_FreeValue` from any thread other than the one
driving that `JSContext` races with the interpreter and can corrupt GC
state, even if it "seems to work" in casual testing.

**The rule: a callback that fires on a library-owned thread must never
touch the `JSContext`/any `JSValue` directly.** It may only write into a
lock-free structure (an atomic flag, a single-producer/single-consumer
ring buffer of plain data) that a JS-thread-side function later drains.
The actual `JS_Call` happens from that JS-thread-side function - a
`.poll()`/`.read()` method the JS side calls periodically or in response
to its own event loop - never from inside the realtime callback itself.

**How to tell which case you're in, before writing a single line of
callback-bridging code**: read the C library's own docs/header comments
for whether the callback is documented to run on the caller's thread or
a library-managed one. Two real examples from directly investigating
this exact question (see `doc/portmidi.md` in this project for the full
writeup): PortMidi's Linux/ALSA backend runs **no internal thread at
all** - `Pm_Read`/`Pm_Poll` are non-blocking calls the JS side must
invoke itself, so `JS_Call` from inside them is on the right thread by
construction; PortAudio's stream callback, by contrast, genuinely runs
on a separate realtime audio thread the library creates, and would need
the ring-buffer pattern above if a binding ever wired `JS_Call` into it
directly (this project's own `quickjs-portaudio.c` avoids the whole
problem by only exposing blocking-I/O `read()`/`write()` methods called
from the JS thread, opening the stream with a NULL native callback -
worth noting as a third valid strategy: **sidestep the realtime callback
entirely** if the library offers a synchronous/blocking alternative,
rather than bridging it).

## 14. Async native calls: bridging into a Promise

The complete template for "wrap a fire-once native async operation as a
`Promise`" (from `qjs-lws`'s async DNS resolve):

```c
typedef struct {
  JSContext *ctx;
  JSValue resolving_funcs[2];   // [0] = resolve, [1] = reject
} MyAsyncQuery;

/* creation site */
MyAsyncQuery *q = js_mallocz(ctx, sizeof(MyAsyncQuery));
JSValue promise = JS_NewPromiseCapability(ctx, q->resolving_funcs);
q->ctx = ctx;
start_native_async_op(..., my_native_callback, q);
return promise;

/* the C library's own callback, guaranteed to fire exactly once */
static void
my_native_callback(void *opaque, int ok, /* ... */) {
  MyAsyncQuery *q = opaque;
  JSContext *ctx = q->ctx;
  JSValue ret;
  if (ok) {
    JSValue result = /* build the result value */;
    ret = JS_Call(ctx, q->resolving_funcs[0], JS_UNDEFINED, 1, (JSValueConst*)&result);
    JS_FreeValue(ctx, result);
  } else {
    JSValue err = JS_NewError(ctx);
    JS_SetPropertyStr(ctx, err, "message", JS_NewString(ctx, "operation failed"));
    ret = JS_Call(ctx, q->resolving_funcs[1], JS_UNDEFINED, 1, (JSValueConst*)&err);
    JS_FreeValue(ctx, err);
  }
  JS_FreeValue(ctx, ret);
  JS_FreeValue(ctx, q->resolving_funcs[0]);
  JS_FreeValue(ctx, q->resolving_funcs[1]);
  js_free_rt(JS_GetRuntime(ctx), q);
}
```
Both `resolving_funcs[0]`/`[1]` come pre-owned from
`JS_NewPromiseCapability`. Free both, and the closure struct itself,
unconditionally in whichever of resolve/reject the callback takes, never
both, never neither. **The C library may call the callback synchronously
(a cache hit) or later from an event loop, so the resolving funcs must
already be stashed in the closure before starting the operation, not
after.**

If your binding does this in more than one place, factor it into a
reusable 2-field struct + three tiny functions (as `qjs-net` does with
its `ResolveFunctions`), rather than hand-rolling the same 15 lines at
every call site:
```c
typedef struct { JSValue resolve, reject; } ResolveFunctions;
JSValue js_async_create(JSContext *ctx, ResolveFunctions *f) { return JS_NewPromiseCapability(ctx, &f->resolve); }
void js_async_free(JSRuntime *rt, ResolveFunctions *f) { JS_FreeValueRT(rt, f->resolve); JS_FreeValueRT(rt, f->reject); }
BOOL js_async_resolve(JSContext *ctx, ResolveFunctions *f, JSValueConst value) { /* call + free */ }
```

**Track ownership of every long-lived `JSValue` explicitly.** A common,
easy-to-miss rule: a `JSValue` obtained from `JS_GetPropertyStr` (or
similar) is already an owned +1 reference, don't `JS_DupValue` it again;
a `JSValue` you were merely handed as an argument (`argv[i]`, `this_val`)
is *not* owned, and must be `JS_DupValue`'d before storing it anywhere
that outlives the current call. Know, for every `JSValue` you stash
long-term, exactly which call produced the reference you're now holding.

## 15. Turning a JS closure into a raw C function pointer (generic FFI)

The reverse direction: a native API wants a bare `void (*)(void*)`-style
function pointer, and you have a JS closure. Since a bare function
pointer has no room for per-call context, the standard trick is: one
fixed trampoline whose address never changes, plus a `void*` the calling
convention is expected to pass through as userdata:
```c
static int64_t
opaque_call(void *arg) {
  CallClosure *call = arg;
  JSValue ret = JS_Call(call->ctx, call->func, call->this_val, 0, NULL);
  int64_t result;
  JS_ToInt64(call->ctx, &result, ret);
  JS_FreeValue(call->ctx, ret);
  return result;
}
```
**This only works cleanly when the native API's calling convention
actually threads a userdata pointer through to the callback**, and the
fixed trampoline signature matches what the native side expects to call.
For truly arbitrary native callback signatures the general-purpose tool
is libffi's `ffi_closure`/`ffi_prep_closure_loc`, which synthesizes a
unique, real function pointer (unique code+data) per closure at runtime.
Reach for that only when the fixed-trampoline trick doesn't fit; it's
meaningfully more machinery.

## 16. Finalizer patterns worth knowing

- **Defensive NULL check, always** (constructor may have failed before
  `JS_SetOpaque` ran): `if (!(s = JS_GetOpaque(val, class_id))) return;`
- **A deliberately empty, no-op finalizer with an explanatory comment**
  is the right call for a resource whose lifetime is entangled with
  another native subsystem you can't be sure is still alive during GC
  (e.g. a GL-backed resource, when the owning GL context might belong to
  a different module and be torn down in an unknown order relative to
  this finalizer):
  ```c
  static void
  my_context_finalizer(JSRuntime *rt, JSValue val) {
    /* Intentionally do NOT tear down GL resources here: this finalizer
     * may run after the owning GL context (owned by a different module)
     * has already been destroyed, which would crash. Callers that need
     * deterministic cleanup must call an explicit Delete/Close API
     * before the GL context goes away. */
    (void)rt; (void)val;
  }
  ```
  Pair this with an explicit `Delete*`/`Close*` method that does the real
  teardown *and* clears the opaque slot (`JS_SetOpaque(obj, NULL)`), so
  any later use-after-delete is caught by the ordinary opaque-NULL check,
  and the (no-op) finalizer has nothing left to double-free even in
  principle.
- **For a C++ object placement-constructed into raw `js_mallocz` memory,
  always call its destructor explicitly before `js_free_rt`** (see
  section 9). `js_free_rt` alone never runs a C++ destructor.

## 17. Naming conventions (consistent across every binding surveyed)

- File names: `quickjs-<lib>.c`/`.cpp`, or a `<lib>js-module.c` +
  `<lib>js-utils.c` split when generic marshalling helpers are large
  enough to be reused across many entry points.
- C identifiers: prefix everything file-scope with the module's own short
  tag (`nvgjs_`, `js_stk`, `js_pa`, ...), this avoids collisions with the
  wrapped library's own C API, which the binding calls directly and sits
  right next to.
- JS-facing names mirror the underlying library's own names as closely
  as possible (`Context.RoundedRectVarying` <-> `nvgRoundedRectVarying`,
  `nvg.ANTIALIAS` <-> `NVG_ANTIALIAS`); minimize invented vocabulary.
- Magic-value enums: `SCREAMING_SNAKE_CASE`, `<SCOPE>_<VARIANT>`
  (`TRANSFORM_TRANSLATE`, `INSTANCE_BIQUAD`).
- Struct-by-value conversion helpers (section 6/8): name them
  `js_<typename>_wrap` (native struct/value -> JS object, e.g.
  `js_padeviceinfo_wrap(ctx, proto, PaDeviceInfo)`) and
  `js_<typename>_fromobj` (JS object -> native struct, e.g.
  `js_pastreamparameters_fromobj(ctx, JSValueConst obj, PaStreamParameters *out)`),
  keyed off the **type being produced**, not the caller/class doing the
  producing, and not a generic verb like `get`. This keeps the two
  directions of the same conversion visibly paired at a glance
  (`_wrap`/`_fromobj` on the same `js_<typename>_` prefix) instead of one
  named after its source (`js_pastream_get_streamparameters`, which reads
  like a `PaStream` method) and the other after its destination.
  **Independently confirmed in `qjs-lws/lws-context.c`**, which already
  uses `_fromobj` for exactly this JS-object-to-native-struct direction
  (`retry_bo_fromobj`, `client_connect_info_fromobj`,
  `tls_connect_info_fromobj`, `lwsjs_context_creation_info_fromobj`)
  alongside its own `_wrap` (`lwsjs_socket_wrap`) - two codebases
  converging on the same suffix independently is the real signal, not
  just a naming preference from one rename.
- `JSClassID` globals: `js_<lib>_<class>_class_id`, one static per class
  (or per hierarchy level, see section 9).

## 18. Documentation and test file conventions

**Every new binding gets a doc file and a test file, not just the `.c`.**
Default locations, applied going forward:
- Doc: `doc/native/<module-name>.md` (e.g. `doc/native/portmidi.md`) -
  API surface, module-level functions/constants, every class with its
  methods/getters, at least one worked example, same shape as this
  project's existing `doc/*.md` files (see e.g. `doc/aubio.md`,
  `doc/stk-io.md` in `qjs-sound` for the established prose/table style
  to match).
- Tests: `tests/test-<module-name>.js` (e.g. `tests/test-portmidi.js`).

**Check the project's own established convention before assuming these
defaults apply, and follow section 0's rule: local convention wins over
an externally-imposed one.** Concretely, `qjs-sound` (this project, as
of this writing) does *not* use `doc/native/` - its docs live flat under
`doc/*.md` (`doc/aubio.md`, `doc/stk-io.md`, `doc/portmidi.md`) - and its
tests are flat `<name>-test.js` files at the repo root, no `tests/`
directory, no `tinytest.js`. Don't silently introduce a new `doc/native/`
subdirectory or a new `tests/` layout into a project that already has an
established, different one; flag the mismatch and ask which to use for
new work, same as any other convention conflict this skill tells you to
surface rather than resolve unilaterally.

**Prefer `tinytest.js` for new test files if the project tree already
uses it anywhere** (`grep -rl tinytest` or look for a `tests/tinytest.js`
file - several sibling projects, e.g. `qjs-modules`, `qjs-net`, `qjs-lws`,
already carry a copy). It's a genuinely minimal, zero-dependency,
MIT-licensed single file (originally `github.com/joewalnes/jstinytest`,
lightly adapted here to call `std.exit(1)` on failure under `qjs`/`qjsm`
so a failing test suite gives CI a nonzero exit code). Shape:

```js
import { tests, assert, assertEquals, eq } from './tinytest.js';

tests({
  async 'openInput throws PmError for an invalid device id'() {
    assert(true, 'placeholder');
  },
});
```

`tests()` is fire-and-forget at module scope (not awaited by the
caller), logs a `PASS`/`FAILED` line per test plus a summary, and exits
nonzero on any failure.

**If the project has no `tinytest.js` anywhere yet, offer to add one and
wait for a yes - never add it (or restructure any existing ad hoc test
files to use it) silently.** Copying the file itself is cheap and safe
either way; the thing that needs sign-off is establishing a new
project-wide testing convention, not the one-file copy.

## 19. Verifying a binding actually works

**A clean compile is necessary, not sufficient.** Before calling binding
work done:

1. **Build it** (section 20), then **actually load it** in the
   interpreter - don't stop at "it compiles." Check which loader the
   project actually uses before assuming: `qjsm` has native ES-module
   `import` support and is what most of these projects' own scripts are
   shebanged with (`#!/usr/bin/env qjsm`); plain `qjs` needs `-m`/
   `--module` flags that mean something different (loading *library*
   modules, not running a script as a module) - don't mix the two up.
2. **Point the project's module-search mechanism at the fresh build
   output**, not a stale installed copy (`QUICKJS_MODULE_PATH=<build-dir>`
   in projects that support it). A stale-install shadowing a local build
   is a real, previously-hit trap in this exact project (a bare `import
   'stk'` silently loading `/usr/local`'s copy instead of the just-built
   one) - always confirm you're actually exercising the code you just
   changed, not a cached older `.so`.
3. **Watch for a `JSClassID` collision if two independently-built copies
   of the QuickJS core can coexist in one process** (one binary statically
   embeds its own QuickJS core while a dynamically-loaded `.so` links a
   separate `libquickjs.so`, or two different builds of the interpreter
   get mixed). Each copy hands out class IDs from its own independent
   counter starting at the same baseline, so two *unrelated* classes
   registered by the two copies can numerically collide - the later
   registration silently overwrites the earlier class's prototype/slot in
   the single shared `JSRuntime`, since `class_array` is runtime-global,
   not scoped per compiled copy of `quickjs.c`. Real, confirmed instance
   (`std-file-methods-broken-after-opencv-import` in `qjs-opencv`'s
   `BUGS`): `std.open(...)`'s returned object ended up with `opencv.Line`'s
   own prototype after both modules were imported in the same script. The
   *symptom* of this bug class is "object X has the wrong
   prototype/methods after importing unrelated native module Y" - that
   shape of bug is a strong signal to check `nm`/`ldd` on both binaries
   for which QuickJS core each one actually links, not to go looking for
   a logic error in either module's own C code.
4. **Smoke-test at minimum**: construct an instance, exercise every
   exported method/getter once, then drop all references and force a GC
   (`gc()`, if the runtime exposes it) so finalizers actually run. Do
   this at least once under a leak/memory-error checker (`-fsanitize=address`
   is normally trivial to add to a debug build) - a finalizer bug like the
   `cvptr` smart-pointer footgun (section 9) produces no visible symptom
   from plain JS and will not be caught by "did it crash," only by a
   tool that actually watches allocations.
5. **When something hangs instead of crashing, reach for `qjsm-debugger`
   (or `qjs-debugger` under plain `qjs`) instead of guessing.** It's a
   gdb-style source debugger for QuickJS (`qjsm-debugger --help` for the
   full flag/command list; `qjsm-debugger --args script.js a b c` spawns
   the debuggee). Two gotchas that waste time if you don't know them
   going in, plus the technique that actually nails a hang to one line:
   - **`QUICKJS_MODULE_PATH` list separator**: the engine's own resolver
     (`quickjs-find-module.c`) accepts both `:` and `;` on Linux in
     principle, but an installed build can behave differently in
     practice - confirmed on one build where a `:`-joined multi-path
     value (e.g. `"$BUILD_DIR:/usr/local/lib/x86_64-linux-gnu/quickjs:/usr/local/lib/quickjs"`)
     broke module resolution outright (`could not load module 'timers'`,
     failing even for `qjsm-debugger` itself, since it's a `qjsm` script
     too), while the exact same paths joined with `;` resolved fine. A
     single path always works regardless of separator, which is why this
     type of bug hides during normal single-path development and only
     surfaces when you add your project's build dir to the default
     search path to run under a debugger. If a multi-path
     `QUICKJS_MODULE_PATH` produces a "could not load module" error for a
     *stdlib* module you never touched, try `;` before assuming a real
     resolver bug.
   - **The debuggee inherits `process.env` from the debugger's own
     invocation** when launched via `--args` (confirmed in
     `qjs-debugger.js`'s spawn call, `env: { ...process.env, ... }`) - so
     set `QUICKJS_MODULE_PATH` (and any other env the debuggee's own
     native modules need) on the `qjsm-debugger` command itself, not
     hoping to inject it some other way.
   - **Nailing a hang to an exact line**: `break FILE:LINE` at the last
     point you're confident executes, `run`, then `next` one line at a
     time (not `continue`) through the suspect region. Every line that
     returns promptly is cleared; the line where `next` itself never
     returns *is* the hang. Confirmed effective for a real hang in
     `qjs-opencv`'s vectorizer GUI this way - single-stepped through an
     entire event-loop iteration (window creation, `imshow`, `waitKey`)
     with each `next` returning in a couple seconds, proving none of
     those individual lines was the problem, before the real cause (a
     native property query that behaved differently under sustained
     real-time use than under manual single-stepping) was found.
   - **`Ctrl-C`/`SIGINT` to the *debugger process* interrupts the running
     debuggee and should print a stop location** - but only if the
     debuggee is actually executing JS bytecode at that moment. If it
     instead prints "(Press Ctrl-C again to quit)" and never reports a
     real stop no matter how long you wait or how many times you send
     the signal, that itself is a diagnostic result: the hang is inside a
     blocking native call (a syscall, a mutex, a native event-loop
     iteration) that the engine's bytecode-level interrupt check can
     never reach, not inside JS. Switch strategy at that point to
     bisecting with breakpoints/`next` across the suspect *native* call
     boundary (previous bullet) rather than continuing to wait on
     interrupt.
   - **Synthetic input (`xdotool key`/`click --window <id>`) is not a
     reliable way to reproduce a GUI/mouse-callback bug** - on at least
     one window manager, window-relative synthetic key/click events
     silently failed to reach a real GTK-backed HighGUI window (no
     breakpoint in the mouse callback ever fired, no visible effect)
     while the same window was fully interactive to real input, and
     `xdotool getwindowgeometry` + absolute-screen-coordinate
     `mousemove`/`click` (no `--window`) *did* work reliably, confirmed
     by screenshotting with `import -window <title> out.png` between
     steps and reading the image back. If synthetic input produces no
     effect at all (not even a wrong effect), suspect the input delivery
     method before suspecting the app; don't conclude a hang exists on
     the strength of synthetic input alone; a live user reproducing the
     bug while the debugger sits armed is more reliable evidence.
6. **Check for, and update, the project's own `BUGS` file.** Both
   `qjs-sound` and `qjs-opencv` maintain a plain-text, canonical-name-keyed
   `BUGS` file (format documented in each project's own `CLAUDE.md`) -
   binding work specifically tends to surface exactly the classes of bug
   covered in this skill (finalizer/ownership bugs, `argv` bounds bugs,
   API-shape mismatches against other bindings). Log anything discovered
   that isn't the thing currently being fixed rather than fixing it
   inline without asking, and check whether anything surfaced during this
   session's own work (a warning, a crash, something that "shouldn't
   happen but did") already got logged before finishing.

## 20. Build: compiling as a loadable `.so`

Two flags matter functionally, not just style, when compiling a
translation unit meant to be `dlopen()`-loadable as a QuickJS module:
```sh
cc -O2 -fPIC -DJS_SHARED_LIBRARY -Wall -c mymodule.c -o mymodule.pic.o -I<path-to-quickjs-headers>
cc -shared -o mymodule.so mymodule.pic.o
```
- `-fPIC`, required for any shared object.
- `-DJS_SHARED_LIBRARY`, required so the `#ifdef JS_SHARED_LIBRARY` block
  (section 1) picks the fixed `js_init_module` symbol name QuickJS's
  runtime module loader looks up via `dlopen`. Omitting it produces a
  `.so` whose init symbol has the wrong name and silently fails to load.

A JS `import` statement (e.g. `import * as mymod from "./mymodule.so"`)
is what actually triggers QuickJS's module loader to `dlopen()` the file
and call its `js_init_module` entry point; nothing in the C code itself
performs the load.

**This is a Linux-flavored example, not the whole story**: the same
translation unit is loaded the same way (a native dynamic library with a
`js_init_module` entry point) on macOS and Windows too, only the
extension and a couple of platform flags differ:

| Platform | Extension | Compile/link flags |
|---|---|---|
| Linux/BSD | `.so` | `-fPIC -DJS_SHARED_LIBRARY`, `cc -shared` |
| macOS | `.dylib` (or `.so`, QuickJS's loader accepts either extension for a native module) | `-fPIC -DJS_SHARED_LIBRARY`, `cc -dynamiclib` |
| Windows (MSVC/MinGW) | `.dll` | `-DJS_SHARED_LIBRARY`, `cc -shared` (`-fPIC` is a no-op/unneeded on Windows) plus `__declspec(dllexport)` on the exported `js_init_module` symbol (MinGW's `-shared` alone is usually enough since QuickJS's own headers already annotate the entry point; MSVC needs a `.def` file or the `__declspec` if building without one) |

A CMake-based project (this skill's own `qjs-sound`/`qjs-nanovg`/etc
included) doesn't need to branch on this by hand: `add_library(name
SHARED ...)` already picks the right extension and linker flags per
platform, so the only thing to actually get right is still `-DJS_SHARED_LIBRARY`.
Don't hardcode `.so` anywhere a path to a compiled module is
constructed (a loader script, a test harness, `doc/native/*.md` sample
code); build it from `CMAKE_SHARED_LIBRARY_SUFFIX` (or, outside CMake,
detect the platform) instead, or the binding silently only works on the
platform it was written on.

## 21. CMake: building a module both shared and static, from the same sources

A module normally only needs the `SHARED` target from section 20 (a
`dlopen()`-loadable `.so`/`.dylib`/`.dll`). Some consumers instead want to
**statically link** the module straight into a custom QuickJS-embedding
executable (no filesystem `.so` to ship, no `dlopen` at runtime) - that
needs a second, `STATIC` target built from the *same* source list, with
one hard constraint: **a `.a` meant to be linked into another binary must
not be `-fPIC`-tainted the way the `.so` build is** (mixing the two in one
set of object files either fails to link or silently produces a slower,
needlessly-relocatable static archive). CMake's own answer to "same
sources, two targets, different flags" is to just declare two targets -
it compiles each target's sources into its own separate object files, so
nothing needs deduplicating by hand. Reference implementation: `qjs-imgui/
cmake/QuickJSModule.cmake`'s `make_module()`/`write_module_cmake()`.

**The two options - plural, `BUILD_SHARED_MODULES`/`BUILD_STATIC_MODULES`**,
declared via a shared `quickjs_module_options()` macro, not hand-rolled
per project. The names are plural even for a single-module project: the
whole point is that the *same* cache-variable name is shared by every
`qjs-*` project in the monorepo, so `-DBUILD_SHARED_MODULES=ON` passed
once to the top-level `quickjs/` build reaches every `add_subdirectory()`d
`qjs-*` submodule unchanged (plain CMake cache-variable inheritance across
`add_subdirectory()` - no extra plumbing needed, *provided* every project
uses the same name). A singular, project-specific name defeats that.

```cmake
# quickjs_module_options([SHARED_DEFAULT <ON|OFF>] [STATIC_DEFAULT <ON|OFF>])
#
# Guarded by NOT DEFINED so a value already set by the caller - this
# project's own earlier option() call, or the outer build - always wins;
# this macro only ever supplies the fallback default. WASI/Emscripten have
# no dlopen()-able shared-module story, so the shared default is forced
# off and the static default forced on there regardless of what the
# caller asked for.
macro(quickjs_module_options)
  cmake_parse_arguments(QMO "" "SHARED_DEFAULT;STATIC_DEFAULT" "" ${ARGN})
  if(NOT DEFINED QMO_SHARED_DEFAULT)
    set(QMO_SHARED_DEFAULT ON)
  endif(NOT DEFINED QMO_SHARED_DEFAULT)
  if(NOT DEFINED QMO_STATIC_DEFAULT)
    set(QMO_STATIC_DEFAULT OFF)
  endif(NOT DEFINED QMO_STATIC_DEFAULT)

  if(WASI OR EMSCRIPTEN OR "${CMAKE_SYSTEM_NAME}" STREQUAL "Emscripten")
    set(QMO_SHARED_DEFAULT OFF)
    set(QMO_STATIC_DEFAULT ON)
  endif(WASI OR EMSCRIPTEN OR "${CMAKE_SYSTEM_NAME}" STREQUAL "Emscripten")

  if(NOT DEFINED BUILD_SHARED_MODULES)
    option(BUILD_SHARED_MODULES "Build shared QuickJS module(s) (*.so)" ${QMO_SHARED_DEFAULT})
  endif(NOT DEFINED BUILD_SHARED_MODULES)
  if(NOT DEFINED BUILD_STATIC_MODULES)
    option(BUILD_STATIC_MODULES "Build static QuickJS module(s) (*.a)" ${QMO_STATIC_DEFAULT})
  endif(NOT DEFINED BUILD_STATIC_MODULES)
endmacro(quickjs_module_options)
```

Put this macro in the project's own `cmake/QuickJSModule.cmake` (create
that file if the project doesn't have one yet - see `qjs-glfw/cmake/
QuickJSModule.cmake` for a from-scratch example that's *only* this
macro, no `make_module()`). Call it **once**, right after that file's
`include()`, with whatever defaults this particular project wants:

```cmake
include(${CMAKE_CURRENT_SOURCE_DIR}/cmake/QuickJSModule.cmake)
quickjs_module_options(SHARED_DEFAULT ON STATIC_DEFAULT OFF)
```

Two ordering traps, both hit for real migrating the five existing
`qjs-*` projects to this macro:
- **Call it exactly once per project.** A project whose own
  `cmake/QuickJSModule.cmake` *also* calls `quickjs_module_options()`
  internally (e.g. from inside `make_module()`, to give the file a usable
  standalone default) races the project's own post-include call: whichever
  runs first wins the `NOT DEFINED` guard, silently discarding the other
  call's `SHARED_DEFAULT`/`STATIC_DEFAULT` arguments. Pick one call site -
  normally the project's `CMakeLists.txt`, right after the `include()` -
  and leave the shared file itself silent on defaults.
- **If the project reads `BUILD_SHARED_MODULES`/`BUILD_STATIC_MODULES`
  before it `include()`s `cmake/QuickJSModule.cmake`** (true of
  `qjs-lws`, whose `CMakeLists.txt` uses them starting at line 26 but only
  `include()`s the file - for an unrelated helper - near line 945), don't
  move the `option()` declarations into the included file at all; they
  have to stay declared at the point of first use. `quickjs_module_options()`
  is still worth having in that project's file for whatever *other* code
  in the same file wants the macro, but nothing there should call it
  itself - the project's earlier plain `option()` calls already won.

**Two independent `add_library()` targets from one source list**, inside
`make_module()`:

```cmake
if(BUILD_SHARED_MODULES)
  add_library(${TARGET_NAME} SHARED ${SOURCES})
  set_target_properties(${TARGET_NAME} PROPERTIES
    OUTPUT_NAME "${VNAME}" POSITION_INDEPENDENT_CODE ON)
  target_compile_definitions(${TARGET_NAME} PRIVATE JS_SHARED_LIBRARY=1 ...)
  # ... target_link_libraries, install(), same as section 20 ...
endif()

if(BUILD_STATIC_MODULES)
  add_library(${TARGET_NAME}-static STATIC ${SOURCES})
  set_target_properties(${TARGET_NAME}-static PROPERTIES
    PREFIX "" OUTPUT_NAME "quickjs-${VNAME}" SUFFIX ".a"
    ARCHIVE_OUTPUT_DIRECTORY "${CMAKE_CURRENT_BINARY_DIR}"
    POSITION_INDEPENDENT_CODE OFF)
  target_compile_definitions(${TARGET_NAME}-static PRIVATE ...)   # no JS_SHARED_LIBRARY
  target_link_libraries(${TARGET_NAME}-static PUBLIC ${LIBS} ${QUICKJS_LIBRARY})
endif()
```

Three details that make this actually work, each confirmed against a real
build (`qjs-imgui`, ImGui + GLFW + OpenGL backends, ~4MB of C++ per
target):
- **`POSITION_INDEPENDENT_CODE` set explicitly on both targets, not left
  to CMake's default.** CMake already defaults `SHARED`/`MODULE` targets
  to PIC, so the `ON` on the shared target is redundant *unless* something
  upstream sets `CMAKE_POSITION_INDEPENDENT_CODE` globally (section 21's
  vendored-library pattern above does exactly that around its
  `add_subdirectory()` calls) - explicit beats implicit here specifically
  because two different global-default sources can otherwise disagree
  silently. The `OFF` on the static target is not redundant at all: if
  `CMAKE_POSITION_INDEPENDENT_CODE` is ever ON globally, an unguarded
  static target would inherit PIC too, defeating the entire reason for
  building it separately.
- **`PREFIX ""` + `SUFFIX ".a"` + `OUTPUT_NAME "quickjs-${VNAME}"` on the
  static target**, not the default `lib${name}.a` CMake would otherwise
  produce, and not the bare `${VNAME}` the `.so` target uses either. The
  `.so` stays bare (`OUTPUT_NAME "${VNAME}"`, section "make_module"
  pattern) because that name is also the `dlopen()`/module-registry key a
  script imports by; the static `.a` has no such runtime-name constraint,
  and a downstream project linking together several modules' archives
  needs them namespaced (`quickjs-imgui.a`, `quickjs-ffi.a`, ...) so a
  wrapped library that happens to share a module's own name (e.g. an
  `imgui` binding against a vendored `libimgui.a`) can't collide with it
  on the linker command line.
- **No object-file sharing to worry about.** Both `add_library()` calls
  list the identical `${SOURCES}`, but each target gets its own
  `CMakeFiles/<target>.dir/*.o` tree and its own `flags.make` - confirmed
  by grepping each target's `flags.make` for `-fPIC` after a build with
  both options ON: present only in the shared target's. This is ordinary
  CMake target semantics, not something the module-authoring code has to
  arrange.

**A `quickjs-<module-name>.cmake` sidecar for the static artifact.**
Unlike a `.so` (self-contained: its own dynamic-linker `NEEDED` entries
carry its dependencies), a `.a` carries no dependency information at all -
whatever links it in must separately supply every transitive library
(`libglfw.so`, `libGL.so`, `libquickjs.so`, ...) `quickjs-mymodule.a`
itself was built against. Since a plain path to a `.a` can't carry that,
write a tiny `.cmake` file next to it, at configure time, named after the
archive itself (`quickjs-<module-name>.a` -> `quickjs-<module-name>.cmake`,
not `<module-name>.a.cmake` or a `.module.cmake` suffix) that a
*different* top-level project's `CMakeLists.txt` can `include()` to pick
those libraries back up:

```cmake
if(BUILD_STATIC_MODULES)
  ...
  set(QUICKJS_${UNAME}_LIBRARIES ${LIBS} ${QUICKJS_LIBRARY})
  set(QUICKJS_${UNAME}_LINK_FLAGS "")   # extra raw linker flags, if any
  file(WRITE "${CMAKE_CURRENT_BINARY_DIR}/quickjs-${VNAME}.cmake" "\
set(QUICKJS_${UNAME}_LIBRARIES \"${QUICKJS_${UNAME}_LIBRARIES}\")
set(QUICKJS_${UNAME}_LINK_FLAGS \"${QUICKJS_${UNAME}_LINK_FLAGS}\")
")
endif()
```

(`UNAME` = `VNAME` upper-cased, dashes to underscores - same derivation
`make_module()` already does for `JS_${UNAME}_MODULE=1`.) Write it right
after the static target's own `target_link_libraries()`, passing that
same library list through so the generated file can never drift out of
sync with what the target was actually linked against. The
`QUICKJS_${UNAME}_` prefix (matching the `.a`/`.cmake` file's own
`quickjs-<module-name>` stem) isn't cosmetic: a module's own
`CMakeLists.txt` frequently already has a same-named variable in scope
from its own dependency detection (`qjs-ffi`'s `FFI_LIBRARIES`, from
`pkg_search_module(FFI libffi)`) - reusing that bare name for the sidecar
output would silently alias the two. `file(WRITE ...)` (not
`file(GENERATE ...)`) is enough here because every value going in is a
plain configure-time CMake variable, not a generator expression that
varies per build configuration; reach for `file(GENERATE ...)` instead
only if a project's static-module deps genuinely differ across
`$<CONFIG>`. Reference implementation: `qjs-ffi/CMakeLists.txt`'s
`BUILD_STATIC_MODULES` block (`quickjs-ffi.a` / `quickjs-ffi.cmake` /
`QUICKJS_FFI_LIBRARIES` / `QUICKJS_FFI_LINK_FLAGS`) - a plain
`CMakeLists.txt`, not a shared `QuickJSModule.cmake` helper, since
`qjs-ffi` is a single-module project with no sibling modules to
generalize the helper across. (`qjs-imgui/cmake/QuickJSModule.cmake`'s
`write_module_cmake()` matches the `quickjs-${VNAME}.a` /
`quickjs-${VNAME}.cmake` file-naming half of this convention, since a
shared helper generalized across sibling modules needs the archive
namespaced the same way regardless of which module calls it, but still
emits its own `${VNAME}_STATIC_LIBRARY`-prefixed variables inside that
file rather than `QUICKJS_${UNAME}_LIBRARIES` - not wrong, just a
different vintage of the variable-naming half; don't silently rename it
to match without the same section 0 "offer the rename, let the user
decide" treatment as any other existing API surface.)

**Naming convention**: `BUILD_SHARED_MODULES`/`BUILD_STATIC_MODULES` -
plural, even in a project with only one module - is the settled monorepo
convention as of the `qjs-glfw`/`qjs-imgui`/`qjs-lws`/`qjs-modules`/
`qjs-nanovg` migration (2026-09), so every `qjs-*` project uses these two
names, not project-scoped or singular variants. This is a real behavior
change for anyone with a cached singular `-DBUILD_SHARED_MODULE=ON` from
before the migration (it silently stops taking effect) - that risk has
already been paid down across the monorepo, but keep it in mind (section
0's closing rule) before renaming a *different*, non-`BUILD_*_MODULES`
option that's already shipped and documented elsewhere.

## 22. CMake wiring for a vendored C/C++ library: system-or-source, always static+PIC

A binding's wrapped library needs to build two ways: against whatever the
system already has installed, or from a vendored copy in `third_party/`
when no system package exists (or a specific/patched/newer version is
wanted). Worked out in full, with a working reference implementation, for
`qjs-sound`'s `portaudio`/`portmidi`/`sndfile`/`samplerate`/`soundtouch`/
`aubio`/`rubberband` bindings - `cmake/FindPortMIDI.cmake` and
`cmake/BuildPortMIDI.cmake` are the smallest complete pair to read first.

**The shape, per library `Foo`:**
- `cmake/FindFoo.cmake` - an `option(BUILD_FOO ... OFF)`
  (default OFF: use the system install, matching what most of these
  libraries already are on a typical dev machine - flip the default to
  ON only for a library with no realistic system package, see aubio's
  own `FindAubio.cmake` for a documented example of when and why). If
  the option is OFF, locate the system library; else
  `include(BuildFoo.cmake)`.
- `cmake/BuildFoo.cmake` - builds the vendored `third_party/foo`
  submodule as a static, `-fPIC` archive, and sets the same result
  variables the system-detection path would.

**Locating a system install** needs three ways in, in priority order,
because different environments have different amounts of control over
where the library actually lives:
1. Explicit hints, settable from the `cmake` command line without
   editing any file: `-DFOO_PREFIX=/usr` (implies `<PREFIX>/include` and
   `<PREFIX>/lib` for whichever of the other two isn't also given), or
   the finer-grained `-DFOO_INCLUDE_DIR=/usr/include
   -DFOO_LIBRARY_DIR=/usr/lib/x86_64-linux-gnu`. This is the pinning
   mechanism a packager/CI job actually needs; a `pkg-config`-only
   `Find*.cmake` doesn't offer any way to pin an install pkg-config
   doesn't already know about.
2. `pkg-config`, when a `.pc` file exists for the library (many do -
   `portaudio-2.0`, `sndfile`, `samplerate`, `soundtouch`, `aubio`,
   `rubberband`; PortMIDI is the one library in this set with no `.pc`
   file on Debian/Ubuntu, confirmed by checking, so its `Find*.cmake`
   skips straight to step 3).
3. Plain `find_path()`/`find_library()` against the default system
   search paths, as a last resort.

**Building from source, correctly, means more than `add_subdirectory()`:**
- **Static, always** - `set(BUILD_SHARED_LIBS OFF CACHE BOOL "" FORCE)`
  before the `add_subdirectory()` call. A vendored library's own
  `CMakeLists.txt` almost always branches on this exact variable (every
  one of the seven libraries above does), so forcing it off is what
  makes `add_library(foo ...)` inside the vendored project actually
  produce a `.a` instead of a `.so`.
- **`-fPIC`, always** - `set(CMAKE_POSITION_INDEPENDENT_CODE ON)` before
  the same call (save/restore the prior value after, since - unlike
  `BUILD_SHARED_LIBS` - there's no reason this one should leak into
  unrelated later targets). A static archive without `-fPIC` can't be
  linked into this project's own shared `.so` modules, which is the
  entire point of building it in the first place (see section 20) -
  skip this and the link step fails with relocation errors, or on some
  platforms silently produces a broken module.
- **...except when section 21's dual shared+static module build is also
  in play - then "always PIC" is wrong, and the vendored library needs
  building *twice*.** Section 21's whole point is that the static module
  target must stay **non**-PIC (so it can be linked cleanly into an
  embedder's own executable); linking a PIC-tainted vendored archive into
  that target defeats it just as surely as leaving the module's own
  object files PIC would. When both `BUILD_SHARED_MODULES` and
  `BUILD_STATIC_MODULES` are `ON` and the vendored library is linked into
  both module targets, build it as **two independent targets from one
  shared source tree**: PIC for the one linked into the `.so`, non-PIC
  for the one linked into the `.a`. Confirmed against `qjs-glfw`'s
  `cmake/BuildGLFW.cmake` (`build_glfw(SOURCE BINARY SUFFIX PIC)`, called
  once per enabled module variant with `SUFFIX` `shared`/`static` and
  `PIC` `ON`/`OFF`), with two gotchas that only show up once you actually
  try it, not from reading the single-build version of this pattern:
  - **A vendored library's own `CMakeLists.txt` may hardcode
    `POSITION_INDEPENDENT_CODE ON` as an explicit target property**, not
    merely rely on the `CMAKE_POSITION_INDEPENDENT_CODE` directory-level
    default - an explicit target property always wins over that default,
    so passing `-DCMAKE_POSITION_INDEPENDENT_CODE:BOOL=OFF` to the
    non-PIC build silently has no effect. Confirmed on GLFW's own
    `src/CMakeLists.txt`, which sets `POSITION_INDEPENDENT_CODE ON`
    directly on its `glfw` target: caught only by grepping the actual
    `flags.make` for `-fPIC` after a from-source build, exactly the same
    verification section 21 already recommends for the module's own
    targets. The fix is the same trick as `DEFINE_SYMBOL` two bullets up
    (this section's other `sed`-patch) - replace the hardcoded `ON` with
    a variable (`sed`, once, in the shared source-prep step:
    `POSITION_INDEPENDENT_CODE ON` -> `POSITION_INDEPENDENT_CODE
    ${GLFW_FORCE_PIC}`), then pass that variable's value
    (`-DGLFW_FORCE_PIC:BOOL=${PIC}`) in each variant's own `CMAKE_ARGS`.
    Don't assume "I set `CMAKE_POSITION_INDEPENDENT_CODE`, so it's
    respected" for any vendored library without checking its own
    `CMakeLists.txt` for a hardcoded property first.
  - **The clone/patch step itself must run exactly once, not once per
    variant.** Two `ExternalProject_Add` targets both pointing
    `GIT_REPOSITORY`/`SOURCE_DIR` at the same shared submodule directory
    race their own download steps against each other - reproduced as a
    real failure (`Error removing directory ... Failed to remove
    directory`) the first time this was tried naively (one
    `ExternalProject_Add` per variant, each with its own full
    `GIT_REPOSITORY`+`UPDATE_COMMAND`). The fix: split a **one-time
    source-prep `ExternalProject_Add`** (clone-if-missing +
    `sed` patch, `CONFIGURE_COMMAND ""` `BUILD_COMMAND ""`
    `INSTALL_COMMAND ""`, guarded by `if(NOT TARGET glfw_source)` so a
    macro called twice only adds it once) from the **per-variant
    configure+build `ExternalProject_Add`** (own `BINARY_DIR` per
    `SUFFIX`, `DOWNLOAD_COMMAND ""` `UPDATE_COMMAND ""`, `DEPENDS
    glfw_source`) - both variants configure/build independently out of
    the one already-prepared `SOURCE_DIR`, so nothing races.
  - Separately, **pin `GIT_REPOSITORY` clones with `GIT_TAG`/`GIT_COMMIT`
    whenever `SOURCE_DIR` already points at a submodule pinned to a
    specific commit** - without it, `ExternalProject_Add` happily
    re-clones the upstream default branch on top of the submodule,
    silently moving it off the pinned commit (and discarding any
    `sed` patch already applied). Not specific to the dual-build pattern
    above, but exactly the kind of thing that only gets noticed by
    actually running the `BUILD_FOO=ON` path once (this section's
    closing rule, restated below) - filed as
    `build-glfw-reclones-past-pinned-commit` in `qjs-glfw/BUGS` after
    being caught this way.
- **Per-library build options forced into the CACHE, not set as plain
  variables** - e.g. `set(SOUNDSTRETCH OFF CACHE BOOL "" FORCE)` to skip
  building SoundTouch's bundled CLI tool. This is not a style
  preference: policy `CMP0077` ("`option()` honors normal variables")
  only takes effect when the *vendored project's own*
  `cmake_minimum_required()` declares CMake ≥ 3.13, and several real
  libraries here declare less (SoundTouch: 3.5, PortAudio: 3.10) - their
  own `cmake_minimum_required()` call resets that policy back to
  OLD/warn *regardless of what the including project set beforehand*,
  even via an explicit `cmake_policy(SET CMP0077 NEW)` right before
  `add_subdirectory()`. This was found the hard way while building this
  exact skill section's reference implementation: a first attempt using
  plain `set()` + `cmake_policy(SET CMP0077 NEW)` produced a real CMake
  dev warning (*"option is clearing the normal variable 'SOUNDSTRETCH'"*)
  and silently built the CLI tool anyway. A pre-existing **cache** entry,
  by contrast, is left alone by a subsequent `option()` call in both OLD
  and NEW policy modes - `option()` only ever creates a cache entry if
  none exists yet, so forcing one first always wins regardless of the
  vendored project's own CMake version. `cmake/VendoredLibrary.cmake`'s
  `vendored_build_static_subdirectory()` does this for every `OPTIONS`
  entry automatically; if writing a `Build*.cmake` from scratch without
  that helper, don't skip this and reach for a plain `set()` instead -
  it'll appear to work on some vendored libraries and silently fail to
  apply on others, exactly like the SoundTouch case above.
- **Same target-name confirmation as any `add_subdirectory()` consumer**
  - after building, check *what CMake target the vendored project's
    `CMakeLists.txt` actually produces* before wiring it into
    `target_link_libraries()`, rather than assuming it matches the
    library's own conventional name. This one is easy to get wrong
    silently: an earlier draft of `cmake/BuildPortMIDI.cmake` listed
    both `portmidi` and `porttime` as link targets, mirroring PortMidi's
    historical two-library split - but in the actual vendored
    `CMakeLists.txt`, `porttime.c` is compiled straight into the
    `portmidi` target, with no separate `porttime` target at all.
    `target_link_libraries()` doesn't error on an unknown target name -
    it just passes it straight through as a linker flag (`-lporttime`),
    which happened to silently link against an unrelated *system*
    `libporttime.a` left over from an old package on the machine this
    was built on, instead of failing loud on a clean machine without
    one. Caught only by testing the from-source build path on a machine
    that happened to have that stray library - a strong argument for
    actually building each `BUILD_FOO=ON` path at least
    once, not just trusting that `add_subdirectory()` "should" work.
  - a static build still needs its own runtime dependencies linked into
    whatever finally consumes it, explicitly - the archive doesn't embed
    them. PortMIDI's ALSA backend and PortAudio's ALSA/JACK backends
    both call directly into system libraries that a static build doesn't
    bundle; both `FindPortMIDI.cmake`/`BuildPortAudio.cmake` locate
    those (`find_package(ALSA REQUIRED)`, `find_library(JACK_LIBRARY
    jack)`) and append them to the same `FOO_LIBRARIES` output variable
    the system-detection path also produces, so a consumer never needs
    to know or care which path was taken.
- **A header-only check for optional API surface, not a compiled-library
  check, if a from-source build is one of the two paths** -
  `check_library_exists()` needs an already-built library file it can
  hand the linker, which doesn't exist yet at configure time for the
  `BUILD_FOO=ON` path (the result variable is just the
  not-yet-built CMake target name at that point). Confirmed the hard way
  building `qjs-portaudio`'s own optional-`Pa_GetStreamHostApiType`
  check against a from-source PortAudio: `check_library_exists()`
  silently found nothing and left the feature undetected even though the
  vendored version does export the symbol, while `check_symbol_exists()`
  (a header-only check that works identically whether the library is
  pre-built or not yet built) got the right answer either way.

**The one real exception - no `CMakeLists.txt` to `add_subdirectory()`
at all:** Rubber Band's upstream build is Meson-only. A first attempt at
`cmake/BuildRubberBand.cmake` shelled out to `meson setup
--default-library=static -Db_staticpic=true ...` + `ninja` via
`ExternalProject_Add` (the "call an external build system, then import
its output as an `IMPORTED` library" shape this same project's
`CMakeLists.txt` already uses for LabSound/STK) - it worked, but added a
hard `meson`/`ninja` dependency and a second, separately-cached configure
pass just to get one static library, unlike every other vendored library
here. The actual `BuildRubberBand.cmake` instead compiles the needed
sources **directly**, with a plain `add_library(rubberband STATIC ...)`:
read `library_sources`/`feature_defines` straight out of the vendored
`meson.build` for the same configuration Meson's own `auto` options
resolve to on Linux (`fft=builtin`, `resampler=builtin` - no external FFT/
resampler dependency needed), which produces the same object code Meson
would, just through one ordinary `add_library()` in this project's own
single configure pass, with no new tool dependency and a real, immediately
resolvable CMake target (not an `IMPORTED` archive path that only exists
after a separate external build step completes). This is more source-list
maintenance than `add_subdirectory()` needs (a future Rubber Band release
adding a source file means updating this list by hand), a real cost worth
naming - but for a single relatively stable library with no
`CMakeLists.txt` to reuse, direct compilation beats carrying a second
build-system dependency. Confirmed working end to end, including a
standalone C-program link test against the resulting `librubberband.a`
that caught a real, easy-to-miss consequence of this approach: **a
vendored library's own build system's per-language linking knowledge
doesn't come along for free** - Meson (or `add_subdirectory()` into a
CMake project that calls `project(... CXX ...)`) would have linked
`libstdc++`/`libm` into anything consuming the library automatically;
compiling the sources directly into a plain `add_library()` target
doesn't confer that, so `RUBBERBAND_LIBRARIES` has to list `stdc++`/`m`
explicitly for the (`.c`, not `.cpp`) consumer that eventually links
against this C++-implemented archive - caught only by actually running
a link, not by "it compiled cleanly." Check what build system a vendored
library actually ships (`meson.build` and no `CMakeLists.txt` is a real,
not rare, case among widely-used C/C++ audio libraries) before assuming
the `add_subdirectory()` shape applies, and weigh source-list maintenance
against a second build-system dependency before picking direct
compilation over `ExternalProject_Add` for a library like this.

**A worth-extracting shared helper, not seven copies of the same
logic:** six of these seven libraries need the exact same
system-detection chain and the exact same static+PIC-forcing
`add_subdirectory()` dance; `cmake/VendoredLibrary.cmake`'s
`vendored_find_system_library()`/`vendored_build_static_subdirectory()`
functions hold that logic once, and every `Find*.cmake`/`Build*.cmake`
pair above is a thin, library-specific configuration of them (header
name, library name(s), `pkg-config` module name, extra system
dependencies, any source patch needed). Extracting this only became
worth doing at seven libraries - for one or two vendored libraries in a
smaller project, writing the system-detection chain and the
static+PIC-forcing `add_subdirectory()` dance directly in each
`Find*.cmake` is simpler and clearer than adding an indirection layer
for its own sake.

**When the vendored dependency is `ExternalProject_Add`-built (a full
nested CMake project configured/built as its own separate step, not
`add_subdirectory()`), "always static+PIC" above is a choice, not a
requirement - and sometimes the wrong one.** A PIC static archive links
into anything (a final executable, another `.so`) with no functional
cost beyond the position-independence overhead itself, so reusing
"always static+PIC" for an `ExternalProject_Add`-built dependency too is
fine, and simplest, when a module builds only `BUILD_SHARED_MODULES` or
only `BUILD_STATIC_MODULES` (section 21), or doesn't care about that
overhead on the static side. It stops being sufficient the moment a
module offers *both* `BUILD_SHARED_MODULES` and `BUILD_STATIC_MODULES`
*and* the vendored dependency is large enough, or the project cares
enough about a lean non-PIE static artifact, that forcing PIC onto every
object file feeding `quickjs-<name>.a` is unwanted.
`qjs-lws`'s vendored `libwebsockets` (pulled in via `ExternalProject_Add`
specifically because it's a full nested CMake project with its own
configure/build steps, unlike this section's `add_subdirectory()`
libraries) hits exactly this: PIC on `lws.so`'s share of it is required,
PIC on `quickjs-lws.a`'s share of it is pure waste.

The mechanism, `qjs-lws/cmake/BuildLibwebsockets.cmake`'s
`build_libwebsockets()` + `qjs-lws/CMakeLists.txt`'s `BUILD_LIBWEBSOCKETS`
block:
- `build_libwebsockets(TARGET <name> PIC <ON|OFF>)` takes a `TARGET` name
  and a `PIC` flag, builds into `${CMAKE_CURRENT_BINARY_DIR}/<name>`
  (never a fixed shared binary dir) and forwards `PIC` straight to the
  vendored project's own PIC-toggle CMake option
  (`-DLWS_STATIC_PIC:BOOL=${PIC}` here - whatever the equivalent option
  is called in a different vendored project). The per-`TARGET` binary
  dir isn't cosmetic: two builds from the one vendored source checkout
  need two separate `BINARY_DIR`s, since a single `ExternalProject_Add`
  binary dir can't hold two different `-fPIC` object trees at once (the
  `SOURCE_DIR` *can* stay shared between both - confirmed safe as long
  as any patch step applied to it is idempotent, e.g. checks
  `git apply --reverse --check` before applying, since each
  `ExternalProject_Add`'s own patch-step stamp is per-`BINARY_DIR` and
  both builds will otherwise try to reapply the same patch to the one
  shared source tree).
- When both `BUILD_SHARED_MODULES` and `BUILD_STATIC_MODULES` are ON, the
  including project's `CMakeLists.txt` calls `build_libwebsockets()`
  *twice* - `TARGET websockets_shared PIC ON` and
  `TARGET websockets_static PIC OFF` - producing two independent
  `ExternalProject_Add` targets, each with its own include/library
  directory. With only one of the two module flavors enabled, a single
  call suffices.
- Each call stashes its own result in per-target output variables
  (`<name>_LWS_INCLUDE_DIR`/`_LWS_LIBRARY_DIR`/`_LWS_LIBRARIES` here -
  name them after whatever the vendored library actually is), **not
  `CACHE`d** - a `CACHE` variable set without `FORCE` silently keeps the
  *first* call's value on a second call in the same configure, which
  would otherwise leave both module flavors linking against whichever
  variant happened to build first. The including project's own
  module-linking macro (section 21's `TARGET_LINK`-style macro) then
  copies the matching variant's values into whatever plain variable name
  it already uses for that dependency, right before linking each of the
  shared/static module targets - so the one link-time macro that already
  existed for sections 20/21 doesn't need to know two vendored builds
  exist at all.
- **Don't reuse the module's own bare link-library name as an
  `ExternalProject_Add` target name.** `target_link_libraries()` treats a
  bare argument that also matches an existing CMake target specially,
  and an `ExternalProject_Add`-created custom target isn't a linkable
  library type - so if the vendored library's plain name (`websockets`
  here, from the `-lwebsockets` already present in the libraries list
  passed to `target_link_libraries()`) is also used as the
  single-build-case `ExternalProject_Add` target name, the link step
  fails outright (*"Target \"websockets\" of type UTILITY may not be
  linked into another target"*) as soon as those two collide. Confirmed
  the hard way building this exact pattern: naming the single-build-case
  target `websockets` (matching the library name for symmetry) broke the
  plain, already-working default `BUILD_SHARED_MODULES`-only
  configuration. Name it something that can't collide with any linked
  library name instead (`libwebsockets` here for the single-build case,
  or the `_shared`/`_static`-suffixed names for the dual-build case).

Reference implementation: `qjs-lws/cmake/BuildLibwebsockets.cmake`
(`build_libwebsockets()`) + `qjs-lws/CMakeLists.txt`
(`BUILD_SHARED_MODULES`/`BUILD_STATIC_MODULES` orchestration; its
`TARGET_LINK` macro applies section 21's `quickjs-<name>.a`/`.cmake`
naming and `QUICKJS_<UNAME>_LIBRARIES`/`_LINK_FLAGS` sidecar convention
on top of whichever vendored-dependency variant it's linking against).

## 23. Every class needs a `Symbol.toStringTag`

`quickjs/examples/point.c` doesn't set one, but every real binding
surveyed does, on every class, without exception - `Point`'s omission is
a minimal-example simplification to skip, not a pattern to copy. Add one
`JS_PROP_STRING_DEF` entry to each class's proto function-list table:

```c
static const JSCFunctionListEntry js_point_proto_funcs[] = {
  JS_CGETSET_MAGIC_DEF("x", js_point_get_xy, js_point_set_xy, 0),
  JS_CGETSET_MAGIC_DEF("y", js_point_get_xy, js_point_set_xy, 1),
  JS_CFUNC_DEF("norm", 0, js_point_norm),
  JS_PROP_STRING_DEF("[Symbol.toStringTag]", "Point", JS_PROP_CONFIGURABLE),
};
```

This is what makes `Object.prototype.toString.call(new Point(1,2))`
report `"[object Point]"` instead of the useless generic `"[object
Object]"` every plain/exotic-less object without a proto chain to a
built-in otherwise gets - and, more practically day to day, it's what a
REPL, `console.log`, or a debugger's object inspector actually displays
for an instance, so a class without it is much harder to identify at a
glance while debugging. `JS_PROP_CONFIGURABLE` (not `JS_PROP_ENUMERABLE`)
matches the spec's own `Symbol.toStringTag` properties (e.g.
`Map.prototype[Symbol.toStringTag]`): present via inspection/`for...in`
opt-out but not accidentally enumerated. Confirmed at scale, not just as
an occasional convention: `qjs-nanovg` (`nvgColor`, `nvgTransform`,
`nvgPaint`, `NVGcontext`, `NVGLUframebuffer`), `qjs-sound`
(`quickjs-stk.cpp`'s `Stk`/`StkFrames`/`Generator`/..., this skill's own
`quickjs-portmidi.c`'s `PmDeviceInfo`/`PmDevices`/`PortMidiStream`), and
across dozens of classes throughout `qjs-opencv` (`js_mat.cpp`,
`js_point.cpp`, `js_rect.cpp`, `js_dnn.cpp`, ...). Add it to every class
you write, including the lightweight struct-by-value/proto-splice
variants from section 6, not just opaque-pointer classes.

## 24. CMake project structure across the qjs-* monorepo

Every `qjs-*` project (`qjs-modules`, `qjs-glfw`, `qjs-imgui`, `qjs-lws`,
`qjs-net`, `qjs-ffi`, `qjs-nanovg`, `qjs-sound`, `qjs-rgfw`, `qjs-debugger`,
...) keeps a `cmake/` directory built from the same handful of
conventionally-named files. **This is a real, load-bearing convention, not
just a naming coincidence** - a project's own `CMakeLists.txt` stays short
by `include()`-ing these, and the *names* (not the file contents) are what
lets `-DBUILD_SHARED_MODULES=...` and friends propagate unchanged through
`add_subdirectory()` across the whole monorepo (section 21). Know the
shape before adding new CMake code to any one of these projects:

| File | Holds | Don't put here |
|---|---|---|
| `cmake/functions.cmake` | Generic, QuickJS-agnostic CMake utility functions/macros with no coupling to modules or vendored libraries: string/list helpers (`BASENAME`, `DIRNAME`, `CONTAINS`, `ADD_UNIQUE`, `ADDPREFIX`/`ADDSUFFIX`), `check_function_exists`/`check_include_file` wrappers (`CHECK_FUNCTION_DEF`, `CHECK_INCLUDE_DEF`), `try_compile`/`try_run` helpers (`TRY_CODE`, `RUN_CODE`, `CHECK_EXTERNAL`), `SYMLINK`, `RPATH_APPEND`. If it would make sense unchanged in a project that had nothing to do with QuickJS, it belongs here. | Anything referencing `qjs-<name>` targets, `JS_INIT_MODULE`, `BUILD_SHARED_MODULES`, or a specific third-party library by name. |
| `cmake/QuickJSModule.cmake` | Everything about building/registering a *QuickJS module specifically*: `quickjs_module_options()` (section 21), `make_module()`/`compile_module()`/`module_path()`, `JS_INIT_MODULE`/`JS_SHARED_LIBRARY` wiring, the `quickjs-<name>.module.cmake` sidecar-export convention. | A specific vendored/system library's discovery or build logic - that's a `Find*`/`Build*` file's job even if the only thing that ever calls it is a module target. |
| `cmake/FindQuickJS.cmake` | Locating the QuickJS engine itself to build/link against: headers, `libquickjs`, `qjsc` (bytecode compiler), `qjs` shell, and - where relevant, e.g. `qjs-lws` - a sibling-built `qjsm` binary. One file, not `Find*`-per-project, since every `qjs-*` project needs the exact same thing here. | Anything about a project's *own* modules - that's `QuickJSModule.cmake`. |
| `cmake/UseMultiArch.cmake` | Multi-arch/cross-compile `CMAKE_INSTALL_LIBDIR`/`CMAKE_ARCH_LIBDIR` detection (`cc -dumpmachine`-based). Generic across every project that installs anything, kept as its own file (not folded into `functions.cmake`) purely because it's large enough and single-purpose enough to read on its own. | — |
| `cmake/check-flags.cmake` | Compiler-flag detection/application (`check_flag`, `check_flags`, `NOWARN_FLAG`, `ADD_NOWARN_FLAGS`). Same "own file for a self-contained concern" reasoning as `UseMultiArch.cmake`. | — |
| `cmake/Find<Library>.cmake` + `cmake/Build<Library>.cmake` | One pair per wrapped third-party library (section 22): `Find*` picks system-vs-vendored and exposes `<LIB>_INCLUDE_DIRS`/`<LIB>_LIBRARIES`; `Build*` builds the vendored copy from `third_party/<lib>`. Library-specific by construction - never shared across libraries even when two `Build*.cmake` files end up structurally similar (see the dual-PIC pattern below). | — |

**The test for "does this belong in a shared file" - use the user's own
rule, verbatim**: a pattern earns extraction out of a project's own
`CMakeLists.txt` into one of the files above when it (a) already appears,
inline, in **at least two** `qjs-*` projects' top-level `CMakeLists.txt`,
or (b) is generically useful to **every** `qjs-*` project even if only one
currently has a clean implementation of it (a compiler-flag-detection
idiom, a way of discovering cross-compilers, locating the QuickJS engine
to build against, ...). Then classify by the table above: QuickJS-module-
build-specific → `QuickJSModule.cmake`; third-party-library-specific →
that library's own `Find*`/`Build*.cmake`; everything else → `functions.cmake`.

**These files are a convention, not a shared library - they drift, and
drift is the normal state, not a bug to panic over.** There's no symlink,
no git submodule, no build-time fetch tying one project's `cmake/foo.cmake`
to another's; each copy is independent, hand-maintained, and only ever
updated when someone happens to be working in that particular project.
Concretely, as surveyed across the monorepo in 2026-09:
- `cmake/BuildLibwebsockets.cmake` in `qjs-lws` gained a dual PIC/non-PIC
  build split (section 22's "vendored dependency is `ExternalProject_Add`-
  built" case) that `qjs-net`'s copy - older, single-PIC-build - never
  received. Confirmed by literally diffing the two: `qjs-net`'s is the
  direct predecessor `qjs-lws`'s evolved from, not an independent design.
- `cmake/FindQuickJS.cmake` in `qjs-lws` detects a sibling-built `qjsm`
  binary in addition to `qjs`; every other project's copy doesn't, because
  nothing else has needed it yet.
- `cmake/QuickJSModule.cmake`'s `quickjs_module_options()` macro (section
  21) exists in `qjs-modules`/`qjs-glfw`/`qjs-imgui`/`qjs-lws` but not
  `qjs-net`/`qjs-sound` (bare bespoke `option()` calls instead) or
  `qjs-ffi`/`qjs-rgfw`/`qjs-nanovg` (no file, or a stub) - a real
  functional gap in the latter group, not merely cosmetic.
- A `module_path(NAME OUTVAR)` helper (centralizing the precompiled-JS-
  module output path, e.g. `${CMAKE_BINARY_DIR}/modules/<name>.c`, instead
  of reconstructing that string at every `compile_module()` call site)
  existed only in `qjs-lws/cmake/QuickJSModule.cmake` until adopted into
  `qjs-modules/cmake/QuickJSModule.cmake` the same day this section was
  written, replacing three separate hand-written copies of that path in
  `qjs-modules/CMakeLists.txt`.

**Before trusting a claim that one project's copy is "missing" something
a sibling has - diff it yourself.** A comparative survey across all ten
`qjs-*` projects' `cmake/` directories, done specifically to write this
section, reported that `qjs-modules/cmake/functions.cmake` was missing
`VAR2DEFINE`/`RUN_CODE`/`LIBNAME` relative to its siblings - concrete-
sounding, cited line numbers, and *wrong*: a direct `diff` against
`qjs-glfw/cmake/functions.cmake` (mirrored losslessly across `qjs-imgui`/
`qjs-nanovg` too) showed the two files are functionally byte-for-byte
identical, differing only in comment style (`##`/`#`) and line-wrapping,
almost certainly from one project having been run through a `cmake-format`
pass (`qjs-modules` has a checked-in `.cmake-format` config; several
siblings don't) and the other not. The lesson isn't "don't survey" - it's
**verify a specific, actionable finding with your own `diff`/`grep` before
editing anything on the strength of it**, exactly as the top-level "no
assumptions in direct answers" discipline already demands elsewhere; a
plausible-sounding line-cited claim is still a claim.

**A same-named macro defined in two different included files is a real,
if usually harmless, footgun - grep before adding one.** CMake
function/macro names are case-insensitive and last-definition-wins with no
redefinition warning. `qjs-modules` has both `functions.cmake` and
`check-flags.cmake` defining `check_flag()`, and includes `functions.cmake`
twice (once before `check-flags.cmake`, once after) - so which file's
`check_flag()` is actually live depends on include order at each call
site. Harmless there only because both copies happen to behave
identically; it would not be harmless if they ever diverged. Before adding
a macro/function to any `cmake/*.cmake` file, `grep -rn 'macro(<name>\|function(<name>'` across the project's whole `cmake/` directory first.

## Reference map: where each pattern came from

| Pattern | Primary source |
|---|---|
| Function-only module, class w/ ctor+finalizer+magic getters | `quickjs/examples/fib.c`, `quickjs/examples/point.c` |
| ArrayBuffer/serialization interop | `quickjs/tests/bjson.c` |
| Prototype/proto-splice, probe-and-discard fallback chain, exotic-style typed-array marshalling library, JS_OBJECT_DEF-adjacent flag export | `qjs-nanovg` |
| C++ hierarchy via type-erased smart pointer (Strategy C) | `qjs-opencv` |
| `argv` bounds-check bug, `cv::Ptr` finalizer-bypass bug (9 instances) | `qjs-opencv/BUGS`: `minmaxloc-argv-out-of-bounds-read`, `cvptr-finalizer-bypasses-refcount-release` |
| Auxiliary `utils.[ch]` pair for type-conversion/array-marshalling helpers, mirrors `cv::_InputOutputArray` | `qjs-nanovg/nvgjs-utils.{c,h}`, `qjs-lws/js-utils.{c,h}`, `qjs-modules/{include,src}/*-utils.{h,c}`, `qjs-opencv/include/js_inputoutputarray.hpp` |
| Realtime/non-JS-thread callback danger, blocking-I/O sidestep | `qjs-sound/quickjs-portaudio.c` vs PortMidi's ALSA backend (`doc/portmidi.md`) |
| `JSClassID` collision across two coexisting QuickJS cores | `qjs-opencv/BUGS`: `std-file-methods-broken-after-opencv-import` |
| C++ hierarchy, one class ID per level + magic constructor (Strategy A) | `qjs-sound/quickjs-stk.cpp` |
| C++ hierarchy, one class ID per leaf + JS_SetPrototype chain (Strategy B) | `qjs-sound/quickjs-labsound.cpp` |
| Exotic classes (`JSClassExoticMethods`) | `qjs-sound/quickjs-portaudio.c` (`PaDevices`) |
| Callback-from-C bridging, leak gotcha | `qjs-glfw` |
| Poll-based alternative to callbacks | `qjs-rgfw` |
| Struct-by-value duck-typed conversion, varargs bridging, JS_OBJECT_DEF at scale | `qjs-imgui` |
| `_wrap`/`_fromobj` naming pair for struct-by-value conversion helpers | `qjs-lws/lws-context.c` (`client_connect_info_fromobj`, `lwsjs_socket_wrap`), `qjs-sound/quickjs-portaudio.c` (`doc/portaudio.md`'s planned `js_pastreamparameters_fromobj`) |
| Promise-from-callback bridging, reusable JSCallback/ResolveFunctions helpers | `qjs-lws`, `qjs-net` |
| JS closure to raw C function pointer trampoline | `qjs-ffi` |
| `Symbol.toStringTag` on every class | `qjs-nanovg`, `qjs-sound` (`quickjs-stk.cpp`, `quickjs-portmidi.c`), `qjs-opencv` (dozens of classes) |
| CMake wiring for a vendored library (system-or-source, static+PIC), `CMP0077`/target-name/header-vs-library-check gotchas | `qjs-sound/cmake/VendoredLibrary.cmake`, `cmake/Find*.cmake`/`Build*.cmake` (portaudio, portmidi, sndfile, samplerate, soundtouch, aubio, rubberband) |
| Dual shared+static module build from one source list, `quickjs-<name>.a` + `quickjs-<name>.cmake` transitive-deps sidecar | `qjs-ffi/CMakeLists.txt` (`BUILD_STATIC_MODULES`, single-module reference implementation, `QUICKJS_FFI_LIBRARIES`-style variables); `qjs-imgui/CMakeLists.txt` (`BUILD_SHARED_MODULES`/`BUILD_STATIC_MODULES`) + `qjs-imgui/cmake/QuickJSModule.cmake` (`make_module()`/`write_module_cmake()`, shared-helper reference implementation, `${VNAME}_STATIC_LIBRARY`-style variables); `qjs-lws/CMakeLists.txt` (pre-existing single-project `TARGET_LINK` macro extended in place, `QUICKJS_LWS_LIBRARIES`/`QUICKJS_LWS_LINK_FLAGS`) |
| `quickjs_module_options()` macro (shared `BUILD_SHARED_MODULES`/`BUILD_STATIC_MODULES` names across the whole monorepo) | `qjs-glfw/cmake/QuickJSModule.cmake` (new file, macro only, no `make_module()`); `qjs-imgui/cmake/QuickJSModule.cmake`, `qjs-lws/cmake/QuickJSModule.cmake`, `qjs-modules/cmake/QuickJSModule.cmake` (macro added alongside each project's own pre-existing `make_module()`) |
| `ExternalProject_Add`-built vendored dependency needing two builds (PIC for the shared module, non-PIC for the static one) instead of "always static+PIC", `ExternalProject_Add` target-name-vs-link-library-name collision | `qjs-lws/cmake/BuildLibwebsockets.cmake` (`build_libwebsockets(TARGET ... PIC ON\|OFF)`) + `qjs-lws/CMakeLists.txt` (`BUILD_SHARED_MODULES AND BUILD_STATIC_MODULES` orchestration); `qjs-glfw/cmake/BuildGLFW.cmake` (`build_glfw(SOURCE BINARY SUFFIX PIC)`, plus the one-time-source-prep-vs-per-variant-build split that avoids two `ExternalProject_Add`s racing a clone against the same submodule dir, and patching a vendored `CMakeLists.txt`'s own hardcoded `POSITION_INDEPENDENT_CODE ON` target property instead of trusting `CMAKE_POSITION_INDEPENDENT_CODE` alone) |

Every citation in this document is file:line-sourced from those trees at
the time this skill was written; treat line numbers as approximate if the
source has moved on, but the patterns themselves are stable QuickJS API
usage, not project-specific.
