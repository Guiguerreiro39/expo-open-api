---
status: accepted
date: 2026-11-23
decision-ticket: https://github.com/Guiguerreiro39/expo-open-api/issues/19
---

# Prototyping Strategy and Progressive Tracer-Bullet Implementation

Evaluating whether high-risk mobile seams (such as WinterCG SSE streaming over native bridges, NativeWind v4 tactile elevation physics, or SecureStore session hydration) require disposable prototype sandboxes before compiling the master specification and slicing implementation issues. We decided to forgo upfront throwaway prototypes, as all architectural seams have been thoroughly de-risked across 6 research tickets (Issues #2–#7) and 11 ADRs (ADR 0001–0011). Instead, implementation will proceed directly by compiling the master specification and ordering the implementation backlog into progressive, permanent tracer-bullet vertical slices. Any unforeseen native runtime defects or TurboModule incompatibilities encountered during implementation will be resolved just-in-time via scoped throwaway branches (`prototype/<topic>`) under the `/prototype` skill.

## Considered Options

- **Upfront Disposable Prototypes in Separate Sandboxes**: Creating throwaway repositories or branches to build isolated spikes for SSE streaming, NativeWind v4 tactile buttons, or SecureStore hydration prior to ticket slicing. This adds redundant developer friction and delays backlog execution without generating persistent value, as all underlying APIs, contracts, and test double patterns are already proven and codified in ADRs 0001–0011.
- **Unstructured Feature Implementation Without Tracer Ordering**: Jumping directly into feature slice implementation without sequencing foundational infrastructure. This risks encountering compounding native build and prebuild breakages late in the development cycle.
- **Progressive Living Tracer Bullets with JIT Spikes (Chosen)**: Sequences the implementation backlog into permanent, production-grade vertical tracer bullets—starting with Expo SDK 52 foundational scaffolding, Continuous Native Generation (CNG) prebuild validation, design tokens, and the in-memory test harness, followed by domain slices. Limits prototyping to strictly just-in-time spikes only if an unanticipated runtime blocker emerges.

## Consequences

- No upfront throwaway prototype code or disposable branches will be built before compiling the master specification and slicing implementation tickets.
- Issue #20 will sequence the implementation backlog as living tracer bullets:
  1. Base Expo SDK 52 environment, Continuous Native Generation (CNG) prebuild verification, and Metro configuration.
  2. Design token bridge, NativeWind v4 HSL channels, and tactile component primitives (`TactilePressable`).
  3. Side-effect-free Composition Root, in-memory test harness (MSW v2, in-memory SecureStore/MMKV doubles), and Orval codegen pipeline.
  4. Vertical domain slices (Auth & Session Bridge, Tasks & Live SSE Query, File Transfers, Showcase).
- Each tracer bullet delivers permanent, verified code committed directly to feature branches and validated against the automated CI and `verify-expo-open-api` skill.
- If an unforeseen native runtime issue or New Architecture C++ incompatibility occurs during implementation, a developer or agent may spin up an isolated spike branch (`prototype/<spike-topic>`) under the `/prototype` skill to diagnose the issue and discard it upon finding resolution.
