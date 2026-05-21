import { z, type ZodTypeAny } from "zod";

export function toolText(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
      },
    ],
  };
}

export function zodToShape<T extends z.ZodRawShape>(schema: z.ZodObject<T>): T {
  return schema.shape;
}

export type AnySchema = ZodTypeAny;
