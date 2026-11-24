# Changelog

## [0.1.2](https://github.com/Guiguerreiro39/expo-open-api/compare/v0.1.1...v0.1.2) (2026-11-24)


### Features

* **forms:** harden zero-jump inputs, form scroll view, form primitives, and auth screens ([3a12567](https://github.com/Guiguerreiro39/expo-open-api/commit/3a12567e8d7190525e471c10738ac6d9d6272fb9))
* **overlays:** harden cross-platform overlays, select, sheet, tooltip, and top toast ([920b5b1](https://github.com/Guiguerreiro39/expo-open-api/commit/920b5b149eb36f92ec1bdd794eb4cd75208a4748))
* **screens:** unify tab chrome, screen ergonomics, and delete confirmations ([b0e646e](https://github.com/Guiguerreiro39/expo-open-api/commit/b0e646e3feb5678c7c5f1fb50c6a81091abb247d))
* **showcase:** overhaul showcase screen and sync runtime verification skill ([a3aa4ce](https://github.com/Guiguerreiro39/expo-open-api/commit/a3aa4ced22fc9f752e0734985b39c5fd4ad1128f))
* **theme:** add tri-layer theme mirroring, wcag tokens, scrim, fonts, and shared verifier ([6654999](https://github.com/Guiguerreiro39/expo-open-api/commit/6654999607d15ff5afc2e983590855df8c7005f7))
* **ui:** add tactile shadow compression, preset geometry, hardened controls and rebuilt slider ([7d88274](https://github.com/Guiguerreiro39/expo-open-api/commit/7d88274b602e809431ca86e956b061ecfed92da1))
* **ui:** overhaul cross-platform ui, theme sync, forms, and primitives ([b196eab](https://github.com/Guiguerreiro39/expo-open-api/commit/b196eabea4f8001b9b38414f69342435242a725b))


### Bug Fixes

* **ui:** resolve all 21 spec-36 interrogate hardening findings ([56daada](https://github.com/Guiguerreiro39/expo-open-api/commit/56daada9eaff7a1fe4ca767b6fdc3501e8e52fc8))
* **ui:** use normal pressable buttons, fix mode contrast, and add screen spacing ([8f7bf92](https://github.com/Guiguerreiro39/expo-open-api/commit/8f7bf924b64b96cdd3a172b8f340c9a1fce2893a))


### Documentation

* **adr:** add adr-0014 and overlay scrim glossary entry for spec 36 ([adf182d](https://github.com/Guiguerreiro39/expo-open-api/commit/adf182d5d96501977f1ef51febff9b9c788c949c))

## [0.1.1](https://github.com/Guiguerreiro39/expo-open-api/compare/v0.1.0...v0.1.1) (2026-11-24)


### Features

* **auth:** add Better Auth mobile client, SecureStore cache, RBAC, and layout guards ([fdc6c12](https://github.com/Guiguerreiro39/expo-open-api/commit/fdc6c1237b49a8360f234edde87f8b9af25a0cee))
* **composition:** add side-effect-free composition root, mock-free test harness, and orval codegen ([94f25c8](https://github.com/Guiguerreiro39/expo-open-api/commit/94f25c850d3af949bae841eb0500c59de73ebd0d))
* **design-system:** add NativeWind v4, HSL token bridge, ThemeProvider, and tactile UI ([9cb13ff](https://github.com/Guiguerreiro39/expo-open-api/commit/9cb13ff258301afe383333a24727c2bd538827bb))
* **files:** add mobile file transfer pipeline, upload queue, and native sharing ([3e4ff48](https://github.com/Guiguerreiro39/expo-open-api/commit/3e4ff48392ac11cc52ebb61977cf4a7e15378845))
* **foundation:** initialize expo sdk 52, cng prebuild, biome, lefthook, and ci ([d91ee4c](https://github.com/Guiguerreiro39/expo-open-api/commit/d91ee4c855ccc5f8152b4c74c6135d91f336436e))
* **scaffolding:** initialize expo sdk 52, cng, biome, lefthook, and ci pipeline ([d4ef107](https://github.com/Guiguerreiro39/expo-open-api/commit/d4ef1078f1cbd185d302d97f79aeb1f8f3c08fe8))
* **showcase:** add Reusables catalog, mobile form primitives, and theme switcher ([749b2d6](https://github.com/Guiguerreiro39/expo-open-api/commit/749b2d6612ff102d4681a1fc1cd2fa192c58670f))
* **starter:** implement expo-open-api mobile starter kit ([7d7baa8](https://github.com/Guiguerreiro39/expo-open-api/commit/7d7baa8b9596053efe8e0bf5a51745d2132181ac))
* **tasks:** add real-time SSE live queries, mutation buffering, and MMKV offline cache ([8e70677](https://github.com/Guiguerreiro39/expo-open-api/commit/8e7067715a60d9246ad0e3ec5d9d3c9ec11ecaeb))


### Bug Fixes

* harden tsconfig, biome fsd rules, and lefthook git hooks ([fef5209](https://github.com/Guiguerreiro39/expo-open-api/commit/fef5209d21006940640d6121a09fd9e6dcb8a3ee))
* **hardening:** resolve all 18 adversarial interrogation findings ([40170a0](https://github.com/Guiguerreiro39/expo-open-api/commit/40170a086caa67db0d8e52ab3044b81a9750c493))


### Documentation

* **adr:** add ADR 0002 for Orval codegen, typed contracts, and mobile error taxonomy ([7a0a3cd](https://github.com/Guiguerreiro39/expo-open-api/commit/7a0a3cd2ec95751ef5e6d6c3b9565311822d3d2e))
* **adr:** add ADR 0003 for Better Auth, SecureStore token flow, and mobile RBAC ([ecb2ef2](https://github.com/Guiguerreiro39/expo-open-api/commit/ecb2ef21e04799adade5cde5621e09cb29e27852))
* **adr:** add ADR 0004 for realtime SSE live queries and mutation buffering ([c2daa0d](https://github.com/Guiguerreiro39/expo-open-api/commit/c2daa0d029e34f24b47ee5762954297358ff1367))
* **adr:** add ADR 0005 for mobile observability, adapters, and trace correlation ([85629ef](https://github.com/Guiguerreiro39/expo-open-api/commit/85629ef5a8a2d27c06d4bf019fa988ed3b864974))
* **adr:** add ADR 0007 for Reusables catalog, mobile form primitives, and showcase ([f4bd51a](https://github.com/Guiguerreiro39/expo-open-api/commit/f4bd51a00269297455fb22c3723e0c117ab6d305))
* **adr:** add ADR 0008 for mobile file transfer pipeline, progress, and sharing ([f7ed3e3](https://github.com/Guiguerreiro39/expo-open-api/commit/f7ed3e372df4cd2df8f211cedc02df9acbcd7783))
* **adr:** add ADR 0009 for mobile testing strategy, test harness, and runtime verification ([57c41c0](https://github.com/Guiguerreiro39/expo-open-api/commit/57c41c0f77fa76cced613b8ca77dedd4f8621e50))
* **adr:** add ADR 0010 for CI/CD pipelines, CNG prebuild validation, and release automation ([790742b](https://github.com/Guiguerreiro39/expo-open-api/commit/790742b019f8b5a87666b1b8a6f800f0ff45f06a))
* **adr:** add ADR 0011 for starter documentation suite, onboarding playbooks, and agent rules ([6f65651](https://github.com/Guiguerreiro39/expo-open-api/commit/6f656519a4e9ad8867833928cb2df25063e08716))
* **adr:** add ADR 0012 for prototyping strategy and tracer-bullet implementation ([c8c4ea5](https://github.com/Guiguerreiro39/expo-open-api/commit/c8c4ea5200e48b5529e0409417454cc3b5c23536))
* **adr:** add ADR 0013 for master specification and backlog slicing ([fedfea2](https://github.com/Guiguerreiro39/expo-open-api/commit/fedfea256232479f353f51500467a285b517ac7d))
* **adr:** add ADR 0013 for master specification and implementation backlog slicing ([fc0ddb3](https://github.com/Guiguerreiro39/expo-open-api/commit/fc0ddb3a3fde5b146aeb78c99aade5487ed44ba9))
* **architecture:** add mobile FSD architecture ADR and initial glossary ([2968da7](https://github.com/Guiguerreiro39/expo-open-api/commit/2968da7441f1dc7aa3ecfe94d1dca22d601b2271))
* **architecture:** decide Better Auth mobile integration and RBAC ([fc0a5c8](https://github.com/Guiguerreiro39/expo-open-api/commit/fc0a5c8b488803aa05bbb401700e584a5900e983))
* **architecture:** decide mobile FSD architecture, layer boundaries, and app composition ([2f9eecd](https://github.com/Guiguerreiro39/expo-open-api/commit/2f9eecd3a3d505998d928fdec17718e6524ec267))
* **design:** add ADR 0006, DESIGN.md contract, and theme tokens to glossary ([664cc73](https://github.com/Guiguerreiro39/expo-open-api/commit/664cc73a6a03aa8207b53b8dcf3826c4c749e47e))
* **starter:** add documentation suite, onboarding playbooks, and verification skill ([9559687](https://github.com/Guiguerreiro39/expo-open-api/commit/955968752214b13679b8844775638c3123022bf6))
