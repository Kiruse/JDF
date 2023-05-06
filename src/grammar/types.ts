import type { Node } from './automaton'

export interface SubGraph {
  root: Node;
  tails: Node[];
}
