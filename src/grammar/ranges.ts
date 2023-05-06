export interface CharCodeRanges {
  subranges: CharCodeRange[];
  includes(char: string): boolean;
  /** Produce unique `CharCodeRanges` given a counterpart, i.e. both ranges' intersections and differences.
   * 
   * @returns `[thisDifference, intersection, otherDifference]`
   */
  unique(other: CharCodeRanges): [CharCodeRanges, CharCodeRanges, CharCodeRanges];
  normalize(): this;
}

export const CharCodeRanges = (subranges: (CharCodeRange | [number, number])[]): CharCodeRanges => ({
  subranges: normalizeSubrangesArg(subranges),
  includes(char: string) {
    if (char.length !== 1) throw Error('Expected single character');
    for (const subrange of this.subranges) {
      if (subrange.includes(char)) return true;
    }
    return false;
  },
  unique(other: CharCodeRanges) {
    const thisDiff  = CharCodeRanges([]);
    const intersect = CharCodeRanges([]);
    const otherDiff = CharCodeRanges([]);
    
    for (const thisSubrange of this.subranges) {
      for (const otherSubrange of other.subranges) {
        if (thisSubrange.overlaps(otherSubrange)) {
          if (thisSubrange.begin < otherSubrange.begin)
            thisDiff.subranges.push(CharCodeRange(thisSubrange.begin, otherSubrange.begin-1));
          if (thisSubrange.end > otherSubrange.end)
            thisDiff.subranges.push(CharCodeRange(otherSubrange.end+1, thisSubrange.end));
          intersect.subranges.push(CharCodeRange(Math.max(thisSubrange.begin, otherSubrange.begin), Math.min(thisSubrange.end, otherSubrange.end)));
        } else {
          thisDiff.subranges.push(thisSubrange);
        }
      }
    }
    
    return [thisDiff.normalize(), intersect.normalize(), otherDiff.normalize()];
  },
  // this normalization differs from the argument normalization: it sorts & merges overlapping ranges
  normalize() {
    const ranges = this.subranges.sort((a, b) => a.begin - b.begin);
    for (let i = 0; i < ranges.length; ++i) {
      if (ranges[i+1].begin <= ranges[i].end+1) {
        const newRange = CharCodeRange(ranges[i].begin, Math.max(ranges[i].end, ranges[i+1].end));
        ranges.splice(i, 2, newRange);
        --i;
      }
    }
    this.subranges = ranges;
    return this;
  },
});

/** Range of char codes, compatible with @unicode/unicode-x.x.x packages */
export interface CharCodeRange {
  begin: number;
  end: number;
  includes(char: string): boolean;
  overlaps(other: CharCodeRange): boolean;
}
export const CharCodeRange = (begin: number | string, end = begin) => {
  begin = normalizeRangeArg(begin);
  end   = normalizeRangeArg(end);
  if (begin > end) throw Error('Range end must be greater than or equal to range begin');
  return {
    begin,
    end,
    includes(char: string) {
      const code = char.charCodeAt(0);
      return code >= this.begin && code <= this.end;
    },
    overlaps(other: CharCodeRange) {
      return this.begin <= other.end && this.end >= other.begin;
    },
  };
}

function normalizeSubrangesArg(subranges: (CharCodeRange | [number, number])[]): CharCodeRange[] {
  return subranges
    .map(sr => Array.isArray(sr) ? CharCodeRange(sr[0], sr[1]) : sr)
    .sort((a, b) => a.begin - b.begin);
}

function normalizeRangeArg(arg: string | number): number {
  if (typeof arg === 'string') {
    if (arg.length !== 1) throw Error('Invalid range character');
    return arg.charCodeAt(0);
  } else {
    return arg;
  }
}
