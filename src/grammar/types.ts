import type { Node } from './automaton'

export interface SubGraph {
  root: Node;
  tails: Node[];
}

/** Range of char codes, compatible with @unicode/unicode-x.x.x packages */
export interface CharCodeRange {
  begin: number;
  end: number;
}
