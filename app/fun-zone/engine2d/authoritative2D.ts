import type { GameBlueprint } from "../laboratory/types";
import { compile2DSpec, validate2DSpec } from "./specCompiler";
import { build2DGameHtml } from "./runtimeCompiler";
import { resolve2DGenre } from "./genreResolver";

export type Authoritative2DBuild={
  html:string;
  genre:string;
  runtimeId:string;
  systems:string[];
};

export function buildAuthoritative2DGame(blueprint:GameBlueprint,prompt?:string):Authoritative2DBuild|null{
  const source=prompt?.trim()||blueprint.concept||blueprint.genre;
  const profile=resolve2DGenre(source)||resolve2DGenre(blueprint);
  if(!profile)return null;
  const spec=compile2DSpec(blueprint,source);
  if(!spec)return null;
  const errors=validate2DSpec(spec);
  if(errors.length)return null;
  return{
    html:build2DGameHtml(spec),
    genre:spec.genre,
    runtimeId:spec.metadata.runtimeId||profile.genre+"-v1",
    systems:spec.systems,
  };
}
