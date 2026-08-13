/**
 * Vibator plugin that orchestrates dependency-cruiser through its JavaScript
 * API. Importing this module registers the `vibator.depcruise` namespace and
 * the `depcruise` rule.
 *
 * @packageDocumentation
 */
import "./namespace/depcruise.ts";
import "./rules/depcruise.ts";

export type {
  DepcruiseNamespace,
  DepcruiseOptions,
  DepcruiseViolation,
} from "./namespace/depcruise.ts";
export { depcruise } from "./namespace/depcruise.ts";
