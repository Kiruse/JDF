{CharCodeRanges, CharCodeRange} = require './ranges'
{expect} = require 'chai'

describe 'CharCodeRanges', ->

describe 'CharCodeRange', ->
  it 'constructs', ->
    expect(CharCodeRange('a')).to.include
      begin: 97
      end:   97
