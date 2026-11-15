# Binding helper code (live document)

The shared C/C++ helpers a binding uses to pass arrays and objects to a native API and get them back. This file is
updated **every time the skill is employed**: add what the work taught (a missing helper, a shape that repeated, a
bug in a helper, a call site that could not use the helpers) in the section it belongs to, and delete what turned out
wrong. State the rule and the reason, no session history. Sections 1 and 2 are the specification, 3 is the inventory,
4 the roadmap, 5 the findings log.

## 1. Design convention: InputArray / OutputArray / InputOutputArray

The helpers are thin C (or C++ templates), optimised, and use the API shape of OpenCV's
`cv::_InputArray` / `_OutputArray` / `_InputOutputArray` (`opencv2/core/mat.hpp`). The names tell the implementor
which helper to pick for a parameter of the bound API:

| Concept | Meaning | Accepts | Cost |
|---|---|---|---|
| InputArray | broadest, read-only, universal | ArrayBuffer, TypedArray, DataView as zero-copy blob of the format the API wants; plain Array and any iterable by reading every element and converting into a temporary blob | zero-copy for views, else one conversion |
| InputOutputArray | narrower: the API reads and writes it | only what yields a zero-copy blob in the right format (ArrayBuffer, TypedArray, DataView) | zero-copy always, else TypeError |
| OutputArray | narrower: the API fills it | a blob with enough room, or a plain Array that is cleared (`splice(0)`) and populated after the call | zero-copy for views, plain Array filled after the call |

Rules for every helper of this family:

- **C and C++ alike use these three concepts, with these names**: C functions are written without separators,
  `<prefix>_inputarray`, `<prefix>_outputarray`, `<prefix>_inputoutputarray` (and `<prefix>_inputarrayofarrays`),
  never `input_array`; C++ types are `InputArray`, `OutputArray`, `InputOutputArray`. These are the names nvgjs-utils
  and qjs-opencv (`js_cv_inputarray`, `JSInputArray`, `JSOutputArray`) already use. Existing names stay as they are, now
  and in the future: nothing is legacy, nothing is renamed or aliased. No project invents its own vocabulary
  (`BufferView`, `JSVector`-only converters, `element<T>` readers) for what one of the three covers; those become
  the implementation behind them
- the element type is a parameter of the helper (`..._inputarray(ctx, T, ...)` in C via a kind enum, template
  argument in C++), not part of its name
- an absent or `undefined`/`null` optional argument is an empty array (OpenCV's `noArray()`), never an error
- the helper reports `JS_EXCEPTION`-style failure (NULL / -1) with the exception already thrown, and clears the
  exception of every probe it discards (section 7 of SKILL.md)
- element conversion is done by one routine per element type (`element<T>::from_js/to_js` in qjs-sound's
  `js-utils.hpp`), not inline at each call site
- a non-blob input allocates a temporary; the helper owns it and the caller releases it with one call
- a pointer into an ArrayBuffer stays valid only while the buffer is neither detached nor resized: take it right
  before the native call and drop it after, never keep it across a `JS_Call` back into JS

## 2. Comparison with OpenCV (checked against mat.hpp, OpenCV 5.1.0)

The definitions match in spirit. Differences worth designing for:

1. **Hierarchy.** In OpenCV `_OutputArray : _InputArray` and `_InputOutputArray : _OutputArray`, so each is a
   superset of the capabilities of the previous one, but takes a narrower set of argument *kinds* (InputArray takes
   const objects, temporaries and expressions, Output/InputOutput only non-const lvalues). "InputArray is the
   broadest" is right for accepted arguments; "narrower" is right for the others. Same in JS: InputArray accepts the
   most shapes, the other two fewer.
2. **OutputArray is `create(size, type)`, not "populate".** The contract of `_OutputArray::create()` is "[re]create
   the output so it has the proper size and type; `Mat::create` for a Mat, `vector::resize` for a vector", and it
   reuses the memory when size and type already fit. Map this to JS: a plain Array is `vector` (clear and refill, or
   resize), a TypedArray is OpenCV's `FIXED_SIZE | FIXED_TYPE` kind: it cannot grow, so the helper needs
   `outputarray_create(n)` that throws RangeError when the blob is too small and reports how many elements were
   written when it is larger. A fixed-size output that is too small is an error in OpenCV too (`create` asserts).
3. **InputOutputArray does not require zero-copy in OpenCV.** It is "read and written", and a `vector<T>` there may
   also be resized by `create`. Zero-copy follows from the argument kinds (Mat header, vector data), it is not the
   definition. Our definition (blob only) is stricter and is a legitimate choice for QuickJS because the alternative
   has a real cost, but it rejects `Array` arguments that a copy-in / copy-back would serve. Suggestion: keep the
   strict helper as the default of the family and add a second, explicit variant that copies in and writes back after
   the call (`..._inputoutputarray_copy`, writes back through the OutputArray path), so a binding chooses
   consciously. Not decided, ask the user before implementing.
4. **Aliasing.** OpenCV allows `src == dst` (in-place, `cv::transform(vec, vec, M)`) and documents that the function
   must cope. The JS equivalent is the same object passed twice: `nvgjs_same_object()` exists for it, make it part of
   the family and call it in every helper that has an input and an output argument.
5. **Element type and shape travel with the value in OpenCV** (`type()`, `size()`, `kind()`), in JS only the
   TypedArray class carries them. A helper must take the wanted element type (and, for structs, `sizeof`: OpenCV's
   `rawIn/rawOut` wrap a custom struct as N bytes) and check or convert. nvgjs-utils is float only; qjs-sound has
   `element<T>`, qjs-opencv `JSArgumentStorage<T>`.
6. **Array of arrays.** OpenCV has `InputArrayOfArrays` (a synonym, used to generate wrappers) plus `getMat(idx)` and
   `size().area()`. Our equivalent is a JS array of arrays/views (qjs-opencv: `PointVectorVector`); give it its own
   name in the family (`inputarrayofarrays`), do not overload `inputarray`.
7. **Call-scoped by contract.** OpenCV says the proxy classes are for passing parameters only, never members or
   globals. State the same: the helper result lives on the stack of the bound function. In C this means an explicit
   release call, in C++ a destructor (qjs-opencv does this: `JSOutputArrayOf<T>` writes back in its destructor).
8. **Optional arguments** use `noArray()`; the JS counterpart is the empty array rule of section 1.
9. **`kind()`.** OpenCV exposes the kind (Mat, vector, ...) and says it is normally not needed. Keep the kind in the
   helper result (blob / array / iterable) for diagnostics and for choosing the write-back path.

## 3. Inventory and status

| Project | Helpers | Role | Status |
|---|---|---|---|
| qjs-nanovg | `nvgjs-utils.[ch]`, 503 lines, float only | reference for C bindings; frozen / production API | see naming mismatch below |
| qjs-sound | `js-utils.[ch]` (iterator, `js_object_from_target`), `js-typedarray.[ch]` (`BufferView`, kinds), `js-iterator.hpp`, `js-utils.hpp` (qjsx namespace: `element<T>`, class registration, native object wrapping) | the `.h` should become the nvgjs-utils.h of C bindings, the `.hpp` the C++ layer | `quickjs-{stk,labsound,sndobj,soundtouch}.cpp` (9048 lines) still repeat shared_ptr wrapping, `dynamic_pointer_cast` + exception, finalizers |
| qjs-opencv | `include/js_*.hpp` (3621 lines with `js_vector.hpp`) | C++ layer around real `cv::_InputArray` | two generations (own helpers, then `JSVector` for the opencv.js vector types), redundant and partly dead |
| qjs-modules | `include/*utils.h`, `src/*utils.c` (8929 lines, themed pairs) | utility layer of the core modules | `js_object_from_target` duplicates the one in qjs-sound's `js-utils.h` |

**nvgjs-utils naming does not match the section 1 definitions** (found 2026-11-15), and because it is the frozen API
the specification adapts, not the file:

- `nvgjs_outputarray(ctx, &len, v)`: strict Float32Array pointer, zero-copy, throws otherwise. This is the
  InputOutputArray of section 1 (blob or TypeError).
- `nvgjs_inputoutputarray(ctx, tmp, n, v)`: blob if Float32Array, else Array or iterable copied into the caller's
  scratch `tmp`; **no write-back**. This is the InputArray of section 1 (nine call sites, all read-only uses such as
  the Transform argument).
- `nvgjs_inputarray(ctx, vec, n, v)`: always copies n floats out. A fixed-size InputArray without the blob path.
- `nvgjs_output(ctx, n, v)`: `outputarray` plus a minimum length.
- `nvgjs_input`, `nvgjs_inputobject`, `nvgjs_inputiterator`: object/iterable readers; `nvgjs_input` has no call site.
- `nvgjs_copyarray`, `nvgjs_copyobject`: write-back, the OutputArray path for plain arrays/objects; there is no
  `splice`-style clear, they overwrite indices.

For new helper families use the names of section 1 with their section 1 meaning and note the difference to nvgjs in
the header comment. The names in nvgjs-utils are right; only the meaning of `nvgjs_inputoutputarray` (blob or
scratch copy, no write-back) differs from section 1, so a new helper family must not copy that meaning.

## 3b. Native class registry (C++): `JSVector<T>` in qjs-opencv

`qjs-opencv/js_vector.{hpp,cpp}` keys the JS class by the **native C++ type**: `JSVector<T>::get_class_id()` and
`get_ctor()` are function-local statics of the template, so `JSVector<T>::fromJS(val)` and `toJS()` need no class-id
global per type, and one `init<T>(ctx, m, name)` registers class, prototype (methods, `Symbol.toStringTag`,
iterator) and constructor. This is the model for a registry in qjs-sound's `qjsx` namespace, where wrapping a
`shared_ptr` of a C++ class with a virtual base repeats class id, proto, ctor, wrap, get and finalizer per class
(SKILL.md section 9, strategies A and B).

What to take over, and what to fix on the way:

- take: type-keyed class id / prototype / constructor storage (`Native<T>::class_id()`), `from_js<T>` and `to_js<T>`
  as the only entry points, one `init<T>` doing registration and export, iterator class generated per type
- take: the `InputArray` / `OutputArray` conversion of the registered types (`js_vector_inputarray` and
  `js_vector_outputarray` try each registered type, which is Strategy B's linear probe: with a type-keyed registry
  that list is generated from the registered types instead of written by hand)
- fix: the type list is written out four times (`js_vector_init`, `js_vector_export`, `js_vector_inputarray`,
  `js_vector_outputarray`); one type list (variadic template or X-macro) drives all four
- fix: `toJS`/`constructor` use `JS_NewObjectClass`, which ignores `new_target.prototype`, so `class X extends
  PointVector` does not work; use `js_object_from_target` (SKILL.md section 3)
- fix: `JSVectorRegistry<T>` is declared and never defined (dead), and `thread_local` statics hold a `JSValue` per
  thread, not per runtime: key by runtime if more than one runtime can exist
- for qjs-sound add what the vector case does not need: the base-class cast. `Native<Base>::get(ctx, val)` returns
  `std::shared_ptr<T>` through `std::dynamic_pointer_cast<T>` and throws a TypeError naming the wanted class when
  the cast or the class check fails; a derived-class registration also registers its prototype chain
  (`JS_SetPrototype`, strategy B) and its entry in the base's "any subclass" probe

## 4. Roadmap (reduce cruft, design to the specification)

Order matters, each step ends with the project building and its tests green.

1. **Freeze the spec.** Turn sections 1 and 2 into a header-comment template (`comment-style`) and one decision: what
   the strict InputOutputArray does with a plain Array (point 3 of section 2). Get the user's answer first.
2. **qjs-nanovg: no change of behaviour.** Add the missing pieces only if a call site needs them
   (`outputarray_create`, empty optional argument); delete `nvgjs_input` if it stays unused after a check of the
   examples and tests; document the mapping table of section 3 in the header.
3. **qjs-sound C layer** (`js-utils.[ch]`, `js-typedarray.[ch]`): make them the nvgjs-utils.h of C bindings: one
   element-type-parametrised family (`kind` enum plus conversion table instead of float only), move the duplicated
   `js_object_from_target` to one copy (qjs-modules `utils.h` is canonical, see SKILL.md section 3), keep `BufferView`
   as the blob type of the family.
4. **qjs-sound C++ layer** (`js-utils.hpp`, namespace `qjsx`): build the type-keyed class registry of section 3b first,
   then add the helpers for the shared_ptr-of-virtual-base case
   of SKILL.md section 9: wrap, get with `std::dynamic_pointer_cast` that throws a QuickJS exception (TypeError naming
   the wanted class), one finalizer template, one constructor-from-factory template. Then replace the repeated code
   in `quickjs-*.cpp` file by file; measure the line count before and after.
5. **qjs-opencv.** Run `qtool` dead-code and identifier tools over `include/js*.hpp` and `js_vector.hpp`, delete what
   has no user, then make `js_inputoutputarray.hpp` the single entry point (`js_cv_inputarray`, `..._outputarray`,
   `..._inputoutputarray`) and let `js_vector.hpp` keep only what opencv.js compatibility needs (PointVector and
   friends). Do not change the JS API without asking (SKILL.md section 0).
6. **qjs-modules.** Only unify what is duplicated with the others (`js_object_from_target`, iterator helpers, array
   length); its themed `*-utils` pairs stay.
7. **Make the inventory mechanical:** a `qtool` run that lists which `<prefix>_*array` helpers each project defines,
   so section 3 can be refreshed instead of hand-written (log as a proposal in `tool-registry/PROPOSALS.md`).

## 5. Findings log

- 2026-11-15: first inventory, shallow (file sizes and the nvgjs call sites counted, no dead-code scan yet); OpenCV
  comparison written (section 2).
- 2026-11-15: user rules: the Input/Output-Array concepts and names apply in C (no separators: `_inputarray`) and C++ alike; qjs-opencv's
  `js_vector.{hpp,cpp}` type-keyed class registry is the model for qjs-sound (section 3b).
- 2026-11-15: review of nvgjs-utils.[ch] (read, not run): `nvgjs_output` returns NULL on a too-short array without
  throwing; `nvgjs_outputarray` accepts any 4-byte typed array, not only Float32Array; `nvgjs_arguments` leaves the
  failed array probe's exception pending and returns 1 (not `vlen`) for the array path; the cached `Symbol.iterator`
  atom is a process static (stale with a second runtime); header banner and guard say `js-utils.h`/`JS_UTILS_H` (clashes
  with qjs-sound and qjs-lws); `nvgjs_utf8offset` is `static`, not `static inline`. Not fixed: the project is frozen,
  the user decides what goes into its BUGS.
- 2026-11-15: fixed in nvgjs-utils.[ch] (user asked): `nvgjs_output` throws RangeError when too short; `nvgjs_outputarray`
  checks the Float32Array class id (builtin class ids are the same in every runtime, so caching one is safe, an atom is
  not); `nvgjs_arguments` clears the probe exception and its doc now says "arguments consumed"; no cached
  `Symbol.iterator` atom (fresh atom per call, freed); header banner/guard `NVGJS_UTILS_H`; `nvgjs_utf8offset` is
  `static inline`. Callers of a helper that can return NULL with an exception pending must clear or propagate it:
  `nvgjs_transform_output` now clears (NULL there means "static call"); the `nvgjs_inputoutputarray` call sites in
  `nvgjs-module.c` that fall back to `tmp` on failure still leave a pending exception (not fixed, found by test).
- 2026-11-15: native vs web (`qjs-nanovg/web`) check: `web/compat-*.js` identical, plus typed-array argument cases
  (Int32Array/short Float32Array/Array/Set/{x,y} as dst or vector) identical after the nvgjs-utils fixes. Before the
  `nvgjs_outputarray` fix native reinterpreted an Int32Array as floats, web did not. Still different, found by test:
  a `Transform` prototype method called with a non-Transform `this` (short Float32Array, Int32Array, `{}`) segfaults
  natively (`nvgjs_transform_function` uses the NULL `mat` from `nvgjs_transform_output` in `nvgTransformPremultiply`),
  web throws TypeError "expecting a Float32Array"; the same function reads `argv[0]`/`argv[1]` without an `argc`
  check. Pre-existing (HEAD crashes too), not fixed. To build the web module without touching the tree: copy `web/`
  and symlink `nanovg/` into a scratch dir, `EM_CACHE=<scratch>/emcache EMCC=$EMSDK/upstream/emscripten/emcc sh build.sh`.
- 2026-11-15: fixed the segfault above in `nvgjs_transform_function`: NULL `mat` throws TypeError "expecting a Float32Array"
  (as web), arguments read through `NVGJS_ARG(i)` (undefined converts to NaN, as web `+undefined`), conversion errors
  propagate, `TransformPoint` input starts as {0,0}, a failed `nvgjs_arguments` with a pending exception propagates
  (`JS_HasException`), static `Inverse` checks `nvgjs_inputarray`. Remaining native/web differences in argument errors:
  a too-short Array to static `Inverse` is RangeError natively, TypeError in web (`readVec` returns null).
- 2026-11-15: fixed the pending exception at the `tmp` fallback call sites in `nvgjs-module.c` (Translate, Scale, Rotate,
  SkewX, SkewY, Multiply, Premultiply, Inverse): they call the module-local `nvgjs_optionalmatrix()`, which clears the
  exception when `nvgjs_inputoutputarray` fails. `Identity` still propagates (an explicit argument that is not a matrix
  is an error there). Rule: a call site that treats a NULL helper result as "not given" must clear the exception, one
  that treats it as an error must return `JS_EXCEPTION`. Built only, no test run.
- 2026-11-15: survey of `quickjs-{labsound,stk,sndobj}.cpp` (9.6k lines) for candidates to go into `js-utils.hpp`, ranked
  by sites removed and bugs prevented (counts are grep counts): (1) `args(ctx, argc, argv, a, b, ...)`: 213 unchecked
  `JS_ToFloat64/Int32/Uint32` statements and 145 `if(argc > N)` reads; an ignored conversion failure leaves the TypeError
  pending while the call returns normally, so a `try/catch` misses it (sndobj `Oscili.setFreq(Symbol())`, stk `NRev`);
  (2) `dispatch<A, B, ...>(base*, f)` for the 6 multi-type ladders (sndobj 3, stk 3; the 68 casts form 28 ladders and 22 of them test a single type, which `dispatch` does not shorten); (3) one `finalize<T>` for 37
  finalizers; (4) table-driven constructor export (stk and sndobj only, labsound registers its classes one by one; stk: 77 `JS_NewCFunction2` + 78 declare + 78 bind, and the enum, the
  `toStringTag` name table and the export list are three parallel copies of one list); (5) `class_group<T>` for the
  14-id `any_audio_node` probe; (6) `self<T>(ctx, this_val, id)` and `node_as<Leaf>(...)` for 100 `JS_GetOpaque2`
  prologues and 28 `dynamic_pointer_cast` + "not an X" sites in labsound; (7) 24 hand-written `new_target.prototype`
  ladders (labsound 15, stk 6, sndobj 3) that `qjsx::wrap` already replaces; (8) `option<T>(ctx, opts, name, out)`
  with absent / present / error as three results (`qjsx::property` returns -1 for both absent and failed).
- 2026-11-16: the helpers of the survey above are in qjs-sound `js-utils.hpp` (`args`/`args_from`/`present`, `dispatch`,
  `require`, `finalize`/`finalize_delete`, `ctor_def` with `declare_ctors`/`bind_ctors`/`ctor_name`, `class_group`,
  `self`/`opaque`/`cast_shared`, `option`, `element<int64_t>`), documented in Doxygen format. Facts the testing taught:
  QuickJS stores NaN into the output of a failed `JS_ToFloat64`, so outputs are unspecified after a failure; a `dispatch`
  lambda is instantiated for every listed type; `qjsm -d` starts the interactive shell, use `qjsm --dump` with stdin closed;
  a test that builds the object inside its `try` passes for the wrong reason when the constructor throws. Plan, recipes and
  call-site inventory: qjs-sound `doc/js-utils-helpers-{plan,recipes,sites}.md`.
