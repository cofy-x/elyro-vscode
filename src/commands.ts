export function statusArgs(projectDir: string): string[] {
  return ["status", "--project-dir", projectDir, "--json"];
}

export function upPlanArgs(projectDir: string): string[] {
  return ["up", "--project-dir", projectDir, "--dry-run", "--json"];
}

export function upArgs(projectDir: string): string[] {
  return ["up", "--project-dir", projectDir, "--json"];
}

export function openArgs(
  projectDir: string,
  editor: "cursor" | "code",
): string[] {
  return ["open", "--project-dir", projectDir, "--editor", editor];
}

export function shellArgs(projectDir: string): string[] {
  return ["shell", "--project-dir", projectDir];
}

export function doctorArgs(projectDir: string): string[] {
  return ["doctor", "--project-dir", projectDir, "--json"];
}

export function downPlanArgs(projectDir: string): string[] {
  return ["down", "--project-dir", projectDir, "--dry-run", "--json"];
}

export function downArgs(projectDir: string): string[] {
  return ["down", "--project-dir", projectDir, "--json"];
}

export function versionArgs(): string[] {
  return ["version", "--json"];
}
