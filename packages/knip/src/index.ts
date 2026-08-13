/**
 * Vibator plugin that orchestrates Knip through its programmatic API.
 * Importing this module registers the `vibator.knip` namespace and the
 * `knip` rule.
 *
 * @packageDocumentation
 */
import "./namespace/knip.ts";
import "./rules/knip.ts";

export type {
  KnipIssue,
  KnipNamespace,
  KnipOptions,
} from "./namespace/knip.ts";
export { knip } from "./namespace/knip.ts";
