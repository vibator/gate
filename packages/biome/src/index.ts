/**
 * Vibator plugin that orchestrates the Biome linter through its JavaScript
 * SDK. Importing this module registers the `vibator.biome` namespace and the
 * `biome` rule.
 *
 * @packageDocumentation
 */
import "./namespace/biome.ts";
import "./rules/biome.ts";

export type {
  BiomeFinding,
  BiomeNamespace,
  BiomeOptions,
} from "./namespace/biome.ts";
export { biome } from "./namespace/biome.ts";
