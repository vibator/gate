/**
 * Vibator plugin carrying the recommended general-purpose rules. Importing
 * this module registers the `vibator.recommended` namespace and every rule.
 *
 * @packageDocumentation
 */
import "./namespace/recommended.ts";
import "./rules/banned-patterns.ts";
import "./rules/codegen-drift.ts";
import "./rules/env-example-sync.ts";
import "./rules/locale-parity.ts";
import "./rules/meaningful-names.ts";
import "./rules/no-conflict-markers.ts";
import "./rules/no-dead-doc-links.ts";
import "./rules/no-deprecated-apis.ts";
import "./rules/prefer-array-methods.ts";
import "./rules/tsdoc-coverage.ts";

export type {
  DeclaredName,
  DeprecatedUsage,
  ManualLoop,
  RecommendedNamespace,
  TsdocOptions,
  TsdocViolation,
} from "./namespace/recommended.ts";
export { recommended } from "./namespace/recommended.ts";
