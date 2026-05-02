export function env(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

export function optionalEnv(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

export function getMinRating(): number {
  return Number(process.env.MIN_RATING || 2100);
}

export function getPollBrackets(): string[] {
  return (process.env.POLL_BRACKETS || "3v3,5v5")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}
