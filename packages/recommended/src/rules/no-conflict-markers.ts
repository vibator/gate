/**
 * The `no-conflict-markers` rule: flags files carrying a marker from an
 * abandoned merge.
 *
 * @packageDocumentation
 */
import {
  type Diagnostic,
  defineRule,
  type File,
  type Line,
  scope,
  vibator,
} from "vibator";
import { z } from "zod";

const RULE_ID = "no-conflict-markers";

/**
 * The four markers git writes, anchored to the start of a line.
 *
 * @remarks `<<<<<<< `, `||||||| ` and `>>>>>>> ` keep their trailing space so a
 * row of angle brackets in prose does not match. `|||||||` only appears under
 * `diff3`, which is why it is the one people forget.
 */
const CONFLICT_MARKER = /^(?:<<<<<<< |\|\|\|\|\|\|\| |={7}$|>>>>>>> )/;

const options = scope.extend({
  /** Every file, because the markers ship silently in non-compiled formats. */
  include: z
    .array(z.string())
    .default(["**/*"])
    .describe("Glob patterns selecting the files the rule judges"),
  /** Nothing excluded by default; a marker is wrong in a test file too. */
  exclude: z
    .array(z.string())
    .default([])
    .describe("Glob patterns removed from that selection"),
});

/**
 * The first conflict marker line no ignore marker silences.
 *
 * @param file - The file to scan.
 * @returns The line, or undefined when the file is clean.
 */
function firstMarker(file: File): Line | undefined {
  return vibator.text
    .lines(file)
    .find(
      (line) =>
        CONFLICT_MARKER.test(line.text) &&
        !vibator.ignore.line(file, line.number, RULE_ID),
    );
}

/**
 * The diagnostic for one file with a marker, one per file because a single
 * merge leaves several marker lines.
 *
 * @param file - The file carrying the marker.
 * @param marker - The first marker line.
 * @returns The diagnostic.
 */
function toDiagnostic(file: File, marker: Line): Diagnostic {
  return {
    file: file.path,
    line: marker.number,
    message: `Unresolved merge conflict marker: ${marker.text.slice(0, 24)}`,
    expected: "No conflict markers in committed files",
    fix: "Finish the merge and delete the <<<<<<<, =======, >>>>>>> lines",
  };
}

export default defineRule({
  id: RULE_ID,
  title: "No unresolved merge conflict markers",
  docs: "@vibator/recommended:docs/rules/no-conflict-markers.md",
  options,
  check({ include, exclude }) {
    const globs = [...include, ...exclude.map((glob) => `!${glob}`)];
    const diagnostics: Diagnostic[] = [];
    vibator.project.files.match(globs).forEach((file) => {
      if (vibator.text.binary(file)) return;
      if (vibator.ignore.file(file, RULE_ID)) return;
      const marker = firstMarker(file);
      if (marker) diagnostics.push(toDiagnostic(file, marker));
    });
    return { diagnostics };
  },
});
