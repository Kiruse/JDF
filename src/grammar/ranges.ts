export class CharCodeRanges {
  subranges: CharCodeRange[];
  
  constructor(subranges: (CharCodeRange | [string | number, string | number])[] = []) {
    this.subranges = normalizeSubrangesArg(subranges);
    this.normalize();
  }
  
  includes(char: string) {
    if (char.length !== 1) throw Error('Expected single character');
    for (const subrange of this.subranges) {
      if (subrange.includes(char)) return true;
    }
    return false;
  }
  
  union(other: CharCodeRanges) {
    return new CharCodeRanges([...this.subranges, ...other.subranges]).normalize();
  }
  
  intersection(other: CharCodeRanges) {
    const result = new CharCodeRanges();
    for (const thisSubrange of this.subranges) {
      for (const otherSubrange of other.subranges) {
        if (thisSubrange.overlaps(otherSubrange)) {
          result.subranges.push(new CharCodeRange(Math.max(thisSubrange.begin, otherSubrange.begin), Math.min(thisSubrange.end, otherSubrange.end)));
        }
      }
    }
    return result.normalize();
  }
  
  difference(other: CharCodeRanges) {
    const result = new CharCodeRanges();
    for (const thisSubrange of this.subranges) {
      let subrange = new CharCodeRange(thisSubrange.begin, thisSubrange.end);
      for (const otherSubrange of other.subranges) {
        if (subrange.begin >= otherSubrange.begin && subrange.end <= otherSubrange.end) {
          subrange.begin = 0;
          subrange.end = -1;
          break;
        }
        if (subrange.begin >= otherSubrange.begin && subrange.begin <= otherSubrange.end) {
          subrange.begin = otherSubrange.end+1;
        }
        if (subrange.end >= otherSubrange.begin && subrange.end <= otherSubrange.end) {
          subrange.end = otherSubrange.begin-1;
        }
      }
      result.subranges.push(subrange);
    }
    return result.normalize();
  }
  
  unique(other: CharCodeRanges) {
    return [this.difference(other), this.intersection(other), other.difference(this)]
  }
  
  // this normalization differs from the argument normalization: it sorts & merges overlapping ranges, and removes empty/negative ranges
  normalize() {
    const ranges = this.subranges.filter(sr => sr.begin <= sr.end).sort((a, b) => a.begin - b.begin);
    for (let i = 0; i < ranges.length-1; ++i) {
      if (ranges[i+1].begin <= ranges[i].end+1) {
        const newRange = new CharCodeRange(ranges[i].begin, Math.max(ranges[i].end, ranges[i+1].end));
        ranges.splice(i, 2, newRange);
        --i;
      }
    }
    this.subranges = ranges;
    return this;
  }
  
  clone() {
    return new CharCodeRanges(this.subranges.map(sr => sr.clone()));
  }
  
  get isEmpty() { return this.size <= 0 }
  get size() { return this.subranges.reduce((sum, sr) => sum + sr.length, 0) }
}

/** Range of char codes, compatible with @unicode/unicode-x.x.x packages */
export class CharCodeRange {
  begin: number;
  end: number;
  constructor(begin: number | string, end = begin) {
    this.begin = normalizeRangeArg(begin);
    this.end   = normalizeRangeArg(end);
  }
  
  includes(char: string) {
    const code = char.charCodeAt(0);
    return code >= this.begin && code <= this.end;
  }
  
  overlaps(other: CharCodeRange) {
    return this.begin <= other.end && this.end >= other.begin;
  }
  
  clone() { return new CharCodeRange(this.begin, this.end) }
  
  get length() { return Math.max(0, this.end - this.begin + 1) }
}

function normalizeSubrangesArg(subranges: (CharCodeRange | [string | number, string | number])[]): CharCodeRange[] {
  return subranges.map(sr => Array.isArray(sr) ? new CharCodeRange(sr[0], sr[1]) : sr);
}

function normalizeRangeArg(arg: string | number): number {
  if (typeof arg === 'string') {
    if (arg.length !== 1) throw Error('Invalid range character');
    return arg.charCodeAt(0);
  } else {
    return arg;
  }
}
