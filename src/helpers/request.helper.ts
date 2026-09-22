export function getStringParam(value: string | string[] | undefined): string {
  if (typeof value !== "string") {
    throw new Error("Parameter tidak valid.");
  }

  return value;
}
