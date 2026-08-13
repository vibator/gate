/**
 * The `recommended` subnamespace: the TypeScript syntax analyses the
 * recommended rules are written against, driven through the `typescript`
 * module.
 *
 * Importing this module registers the namespace onto the shared `vibator`
 * object, so rules reach it as `vibator.recommended`.
 *
 * @packageDocumentation
 */
import { vibator } from "vibator";
import { declaredNames } from "./declared-names.ts";
import { deprecatedUsages } from "./deprecations.ts";
import { manualLoops } from "./manual-loops.ts";
import { tsdocViolations } from "./tsdoc.ts";

/** Analyse TypeScript syntax for the recommended rules. */
export const recommended = {
  declaredNames,
  deprecatedUsages,
  manualLoops,
  tsdocViolations,
};

/** The shape the recommended namespace adds to `vibator`. */
export type RecommendedNamespace = typeof recommended;

export type { DeclaredName } from "./declared-names.ts";
export type { DeprecatedUsage } from "./deprecations.ts";
export type { ManualLoop } from "./manual-loops.ts";
export type { TsdocOptions, TsdocViolation } from "./tsdoc.ts";

Object.assign(vibator, { recommended });
