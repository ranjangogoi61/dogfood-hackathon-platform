export interface FixtureImportPlan {
  users: number;
  events: number;
  tracks: number;
  teams: number;
  projects: number;
  judges: number;
  assignments: number;
  scores: number;
}

export function planImport(_: unknown): FixtureImportPlan {
  throw new Error("Fixture importer not implemented yet.");
}
