import type { PositionName } from "../schemas/worldbook-draft.js";

export const POSITION_TO_NUMBER: Record<PositionName, number> = {
  before_char: 0,
  after_char: 1,
  before_an: 2,
  after_an: 3,
  at_depth: 4,
  before_em: 5,
  after_em: 6,
  outlet: 7,
};

export const NUMBER_TO_POSITION: Record<number, PositionName> = {
  0: "before_char",
  1: "after_char",
  2: "before_an",
  3: "after_an",
  4: "at_depth",
  5: "before_em",
  6: "after_em",
  7: "outlet",
};

export function positionToNumber(position: PositionName): number {
  return POSITION_TO_NUMBER[position];
}

export function numberToPosition(position: number): PositionName | undefined {
  return NUMBER_TO_POSITION[position];
}
