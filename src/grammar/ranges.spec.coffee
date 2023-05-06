{CharCodeRanges, CharCodeRange} = require './ranges'
{expect} = require 'chai'

describe 'CharCodeRange', ->
  it 'constructs', ->
    expect(CharCodeRange('a')).to.include
      begin: 97
      end:   97
    expect(CharCodeRange('a', 'c')).to.include
      begin: 97
      end:   99
    expect(=> CharCodeRange('c', 'a')).to.throw()
  it 'includes', ->
    expect(CharCodeRange('a', 'c').includes('a')).to.be.true
    expect(CharCodeRange('a', 'c').includes('b')).to.be.true
    expect(CharCodeRange('a', 'c').includes('c')).to.be.true
    expect(CharCodeRange('a', 'c').includes('d')).to.be.false
  it 'overlaps', ->
    expect(CharCodeRange('a', 'c').overlaps(CharCodeRange('b', 'd'))).to.be.true
    expect(CharCodeRange('a', 'c').overlaps(CharCodeRange('c', 'd'))).to.be.true
    expect(CharCodeRange('a', 'c').overlaps(CharCodeRange('d', 'e'))).to.be.false

describe 'CharCodeRanges', ->
  it 'constructs', ->
    expect(CharCodeRanges([['a', 'c']])).to.lookLike
      subranges: [
        begin: 97
        end:   99
      ]
    expect(CharCodeRanges([['a', 'c'], ['e', 'f']])).to.lookLike
      subranges: [
        begin: 97
        end:   99
      ,
        begin: 101
        end:   102
      ]
  it 'normalizes', ->
    ranges = CharCodeRanges([['e', 'k'], ['a', 'c']])
    expect(ranges.subranges[0]).to.include
      begin: 97
      end:   99
    expect(ranges.subranges[1]).to.include
      begin: 101
      end:   107
    
    ranges = CharCodeRanges([['e', 'k'], ['f', 'h']])
    expect(ranges.subranges).to.be.lengthOf 1
    expect(ranges.subranges[0]).to.include
      begin: 101
      end:   107
    
    ranges = CharCodeRanges([['a', 'c'], ['d', 'f']])
    expect(ranges.subranges).to.be.lengthOf 1
    expect(ranges.subranges[0]).to.include
      begin: 97
      end:   102
  it 'produces unique ranges', ->
    r1 = CharCodeRanges([['a', 'c'], ['e', 'f']])
    r2 = CharCodeRanges([['c', 'e']])
    [r1diff, rUnion, r2diff] = r1.unique(r2)
    expect(r1diff.subranges).to.be.lengthOf 2
    expect(r1diff.subranges).to.lookLike [
      begin: 97
      end:   98
    ,
      begin: 102
      end:   102
    ]
    expect(r2diff.subranges).to.be.lengthOf 1
    expect(r2diff.subranges).to.lookLike [
      begin: 100
      end:   100
    ]
    expect(rUnion.subranges).to.be.lengthOf 2
    expect(rUnion.subranges).to.lookLike [
      begin: 99
      end:   99
    ,
      begin: 101
      end:   101
    ]
