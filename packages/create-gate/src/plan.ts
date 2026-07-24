/**
 * The data model the wizard passes between detection, decision and apply.
 *
 * @packageDocumentation
 */

/** The npm-compatible package managers the wizard can drive. */
export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

/** What to do about the lint and vibator configurations. */
export type ConfigAction = "create" | "extend" | "skip";

/** Paths of the relevant configurations found in the repository. */
export interface FoundConfigs {
  /** Biome configuration, when present. */
  biome?: string;
  /** ESLint configuration, when present. */
  eslint?: string;
  /** Prettier configuration, when present. */
  prettier?: string;
  /** knip configuration, when present. */
  knip?: string;
  /** dependency-cruiser configuration, when present. */
  depcruise?: string;
  /** vibator configuration, when present. */
  vibator?: string;
  /** TypeScript configuration, when present. */
  tsconfig?: string;
  /** commitlint configuration, when present. */
  commitlint?: string;
}

/** Which git hook managers the repository already uses. */
export interface FoundHookManagers {
  /** Whether a `.husky/` directory exists. */
  husky: boolean;
  /** Whether lefthook is configured or installed. */
  lefthook: boolean;
  /** Whether simple-git-hooks is configured or installed. */
  simpleGitHooks: boolean;
}

/** Everything detection learned about the target repository. */
export interface Snapshot {
  /** Absolute path of the repository root. */
  root: string;
  /** Whether a package.json exists; nothing works without one. */
  hasPackageJson: boolean;
  /** Whether the root is a git repository. */
  isGitRepository: boolean;
  /** The package manager the repository uses. */
  packageManager: PackageManager;
  /** Whether the project uses TypeScript (tsconfig or dependency). */
  usesTypeScript: boolean;
  /** Whether tsconfig.json is plain JSON with no `extends` of its own. */
  tsconfigExtendable: boolean;
  /** Whether package.json declares workspaces. */
  hasWorkspaces: boolean;
  /** Whether a `src/` directory exists. */
  hasSourceDirectory: boolean;
  /** The npm scripts already declared. */
  scripts: Record<string, string>;
  /** Package names already installed as dependencies of any kind. */
  installedPackages: string[];
  /** The configurations found. */
  configs: FoundConfigs;
  /** The hook managers found. */
  hooks: FoundHookManagers;
  /** Whether `.github/workflows/quality.yml` already exists. */
  hasQualityWorkflow: boolean;
  /** The agent instructions file, `AGENTS.md` before `CLAUDE.md`. */
  agentsFile?: string;
}

/** One choice per decision point, resolved from flags, prompts or defaults. */
export interface Answers {
  /** What to do about Biome. */
  lint: ConfigAction;
  /** Whether to include knip. */
  knip: boolean;
  /** Whether to create a dependency-cruiser config. */
  depcruise: boolean;
  /** What to do about vibator. */
  vibator: ConfigAction;
  /** Whether to point tsconfig.json at the gate's strict base. */
  tsconfig: boolean;
  /** Whether to wire git hooks. */
  hooks: boolean;
  /** Whether to set up commitlint. */
  commitlint: boolean;
  /** Whether to add the quality CI workflow. */
  ci: boolean;
  /** Whether to install agent guidance (skill and AGENTS.md section). */
  agents: boolean;
}

/** A new file the wizard will create. Never overwrites an existing one. */
interface FileCreation {
  /** Repo-relative path. */
  path: string;
  /** Full contents. */
  contents: string;
}

/** A surgical change to an existing file. */
export interface FileChange {
  /** What to do: add an extends entry, or append missing lines. */
  kind: "prepend-extends" | "tsconfig-extends" | "append-lines";
  /** Repo-relative file to change. */
  path: string;
  /** The package export to point at, for the extends kinds. */
  specifier?: string;
  /** Lines to add when absent, for `append-lines`. */
  lines?: string[];
  /**
   * For `append-lines`: skip the whole append when the file already
   * contains this marker. Keeps prose sections whole across wizard
   * versions, where per-line checks would interleave old and new wording.
   */
  guard?: string;
}

/** A change the wizard offers after applying, run only with consent. */
export type FollowUp =
  | {
      /** A shell command to run. */
      kind: "command";
      /** Why running it is worth it. */
      reason: string;
      /** The exact shell command. */
      command: string;
    }
  | {
      /** Replacing an npm script the apply step refused to overwrite. */
      kind: "replace-script";
      /** Why replacing it is worth it. */
      reason: string;
      /** The script name. */
      name: string;
      /** The command the script would become. */
      command: string;
    };

/** Everything the wizard intends to do, shown before anything happens. */
export interface Plan {
  /** The package manager that will run the installs. */
  packageManager: PackageManager;
  /** devDependencies to install, `latest` of each. */
  installs: string[];
  /** New files. */
  creations: FileCreation[];
  /** Changes to existing files. */
  changes: FileChange[];
  /** npm scripts to add; existing scripts are never overwritten. */
  scripts: Record<string, string>;
  /** Changes offered after apply, run only with explicit consent. */
  followUps: FollowUp[];
  /** Decisions taken and things left alone, stated for the user. */
  notes: string[];
}

/** One unit of wizard work; every key maps to one plan builder. */
export type StepKey =
  | "lint"
  | "knip"
  | "depcruise"
  | "tsconfig"
  | "vibator"
  | "hooks"
  | "commitlint"
  | "ci"
  | "scripts"
  | "agents";

/** The step order: vibator closes the tools, the surroundings follow. */
export const STEP_ORDER: StepKey[] = [
  "lint",
  "knip",
  "depcruise",
  "tsconfig",
  "vibator",
  "hooks",
  "commitlint",
  "ci",
  "scripts",
  "agents",
];

/** The npm package every gated repository depends on. */
export const GATE_PACKAGE = "@vibator/gate";
