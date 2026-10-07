import type { GameSpecification2D } from "./types";
import { buildGenreRuntime } from "./registry";

export function build2DGameHtml(spec:GameSpecification2D):string{
  return buildGenreRuntime(spec);
}
