import { LABS } from "./normalize";
import { labLogo } from "./lab-logos";
import type { Lab, Snapshot } from "./types";

/** The grey a lab gets when nobody gave it a color. */
const NO_COLOR = "#A3A39B";
const known = new Map(LABS.map((l) => [l.id, l]));

/** A snapshot lab with the name and chart color the code knows. Only a lab with no color of its own takes LABS' color; a named lab keeps its name. */
export function labIdentity(lab: Lab): Lab {
  const own = known.get(lab.id);
  if (own) return { ...lab, name: lab.name === lab.id || !lab.name ? own.name : lab.name, color: !lab.color || lab.color.toUpperCase() === NO_COLOR ? own.color : lab.color };
  const logo = lab.name === lab.id ? labLogo(lab.id) : undefined;
  return logo ? { ...lab, name: logo.name } : lab;
}

/** Snapshots saved before a lab was named or colored (a lab seen first on a benchmark board is listed by its id, in grey) read as today's. */
export const withLabIdentity = (s: Snapshot): Snapshot => ({ ...s, labs: s.labs.map(labIdentity) });
