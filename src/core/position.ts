import type { z } from "zod";
import type { PositionSchema } from "../schemas/draft.js";

export type PositionName = z.infer<typeof PositionSchema>;

export function positionToNumber(position: PositionName): number {
  const map: Record<PositionName, number> = {
    before_char: 0,
    after_char: 1,
    before_an: 2,
    after_an: 3,
    at_depth: 4,
    before_em: 5,
    after_em: 6,
    outlet: 7,
  };
  return map[position];
}

export function numberToPosition(value: number): PositionName {
  const map: Record<number, PositionName> = {
    0: "before_char",
    1: "after_char",
    2: "before_an",
    3: "after_an",
    4: "at_depth",
    5: "before_em",
    6: "after_em",
    7: "outlet",
  };
  return map[value] ?? "after_char";
}
