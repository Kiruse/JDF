{expect} = require 'chai'
match = require('./match').default

describe 'match', ->
  describe 'literal', ->
    describe 'free', ->
      it 'works 1', ->
        m1 = match"foo"
        expect(m1.type).to.equal 'chain'
        expect(m1.matchers.length).to.equal 1
        
        expect(m1.matchers[0].type).to.equal 'literal'
        expect(m1.matchers[0].match).to.equal 'foo'
      it 'works 2', ->
        m1 = match"bar"
        expect(m1.type).to.equal 'chain'
        expect(m1.matchers.length).to.equal 1
        
        expect(m1.matchers[0].type).to.equal 'literal'
        expect(m1.matchers[0].match).to.equal 'bar'
    describe 'quoted', ->
      it 'single quote', ->
        m1 = match"'foo bar'"
        expect(m1.type).to.equal 'chain'
        expect(m1.matchers.length).to.equal 1
        
        expect(m1.matchers[0].type).to.equal 'literal'
        expect(m1.matchers[0].match).to.equal 'foo bar'
      it 'double quote', ->
        m1 = match"\"foo bar\""
        expect(m1.type).to.equal 'chain'
        expect(m1.matchers.length).to.equal 1
        
        expect(m1.matchers[0].type).to.equal 'literal'
        expect(m1.matchers[0].match).to.equal 'foo bar'
      it 'mixed quotes (fails)', ->
        expect(=> match"\"foo bar'").to.throw('Expected quote end """')
  describe 'chain', ->
    it 'works 1', ->
      m1 = match"foo bar"
      expect(m1.type).to.equal 'chain'
      expect(m1.matchers.length).to.equal 2
      
      expect(m1.matchers[0].type).to.equal 'literal'
      expect(m1.matchers[0].match).to.equal 'foo'
      
      expect(m1.matchers[1].type).to.equal 'literal'
      expect(m1.matchers[1].match).to.equal 'bar'
    it 'works 2', ->
      m1 = match"foo bar baz"
      expect(m1.type).to.equal 'chain'
      expect(m1.matchers.length).to.equal 3
      
      expect(m1.matchers[0].type).to.equal 'literal'
      expect(m1.matchers[0].match).to.equal 'foo'
      
      expect(m1.matchers[1].type).to.equal 'literal'
      expect(m1.matchers[1].match).to.equal 'bar'
      
      expect(m1.matchers[2].type).to.equal 'literal'
      expect(m1.matchers[2].match).to.equal 'baz'
    it 'works 3', ->
      m1 = match"foo bar baz qux"
      expect(m1.type).to.equal 'chain'
      expect(m1.matchers.length).to.equal 4
      
      expect(m1.matchers[0].type).to.equal 'literal'
      expect(m1.matchers[0].match).to.equal 'foo'
      
      expect(m1.matchers[1].type).to.equal 'literal'
      expect(m1.matchers[1].match).to.equal 'bar'
      
      expect(m1.matchers[2].type).to.equal 'literal'
      expect(m1.matchers[2].match).to.equal 'baz'
      
      expect(m1.matchers[3].type).to.equal 'literal'
      expect(m1.matchers[3].match).to.equal 'qux'
  describe 'options', ->
    it 'works 1', ->
      m1 = match"foo | bar"
      expect(m1.type).to.equal 'options'
      expect(m1.matchers.length).to.equal 2
      
      expect(m1.matchers[0].type).to.equal 'chain'
      expect(m1.matchers[0].matchers.length).to.equal 1
      expect(m1.matchers[0].matchers[0].type).to.equal 'literal'
      expect(m1.matchers[0].matchers[0].match).to.equal 'foo'
      
      expect(m1.matchers[1].type).to.equal 'chain'
      expect(m1.matchers[1].matchers.length).to.equal 1
      expect(m1.matchers[1].matchers[0].type).to.equal 'literal'
      expect(m1.matchers[1].matchers[0].match).to.equal 'bar'
    it 'works 2', ->
      m1 = match"foo | bar | baz"
      expect(m1.type).to.equal 'options'
      expect(m1.matchers.length).to.equal 3
      
      expect(m1.matchers[0].type).to.equal 'chain'
      expect(m1.matchers[0].matchers.length).to.equal 1
      expect(m1.matchers[0].matchers[0].type).to.equal 'literal'
      expect(m1.matchers[0].matchers[0].match).to.equal 'foo'
      
      expect(m1.matchers[1].type).to.equal 'chain'
      expect(m1.matchers[1].matchers.length).to.equal 1
      expect(m1.matchers[1].matchers[0].type).to.equal 'literal'
      expect(m1.matchers[1].matchers[0].match).to.equal 'bar'
      
      expect(m1.matchers[2].type).to.equal 'chain'
      expect(m1.matchers[2].matchers.length).to.equal 1
      expect(m1.matchers[2].matchers[0].type).to.equal 'literal'
      expect(m1.matchers[2].matchers[0].match).to.equal 'baz'
    it 'works 3', ->
      m1 = match"foo bar | baz"
      expect(m1.type).to.equal 'options'
      expect(m1.matchers.length).to.equal 2
      
      expect(m1.matchers[0].type).to.equal 'chain'
      expect(m1.matchers[0].matchers.length).to.equal 2
      expect(m1.matchers[0].matchers[0].type).to.equal 'literal'
      expect(m1.matchers[0].matchers[0].match).to.equal 'foo'
      expect(m1.matchers[0].matchers[1].type).to.equal 'literal'
      expect(m1.matchers[0].matchers[1].match).to.equal 'bar'
      
      expect(m1.matchers[1].type).to.equal 'chain'
      expect(m1.matchers[1].matchers.length).to.equal 1
      expect(m1.matchers[1].matchers[0].type).to.equal 'literal'
      expect(m1.matchers[1].matchers[0].match).to.equal 'baz'
  describe 'any', ->
    it 'works 1', ->
      m1 = match"."
      expect(m1.type).to.equal 'chain'
      expect(m1.matchers.length).to.equal 1
      expect(m1.matchers[0].type).to.equal 'any'
    it 'works 2', ->
      m1 = match"foo.bar"
      expect(m1.type).to.equal 'chain'
      expect(m1.matchers.length).to.equal 3
      
      expect(m1.matchers[0].type).to.equal 'literal'
      expect(m1.matchers[0].match).to.equal 'foo'
      
      expect(m1.matchers[1].type).to.equal 'any'
      
      expect(m1.matchers[2].type).to.equal 'literal'
      expect(m1.matchers[2].match).to.equal 'bar'
  describe 'ranges', ->
    it 'works 1', ->
      m1 = match"f[aeiou]o"
      expect(m1.type).to.equal 'chain'
      expect(m1.matchers.length).to.equal 3
      
      expect(m1.matchers[0].type).to.equal 'literal'
      expect(m1.matchers[0].match).to.equal 'f'
      
      expect(m1.matchers[1].type).to.equal 'range'
      expect(m1.matchers[1].ranges).to.deep.equal [
        { begin:  97, end:  97 },
        { begin: 101, end: 101 },
        { begin: 105, end: 105 },
        { begin: 111, end: 111 },
        { begin: 117, end: 117 },
      ]
      
      expect(m1.matchers[2].type).to.equal 'literal'
      expect(m1.matchers[2].match).to.equal 'o'
    it 'merges adjacent ranges', ->
      m1 = match"[abc]"
      expect(m1.type).to.equal 'chain'
      expect(m1.matchers.length).to.equal 1
      
      expect(m1.matchers[0].type).to.equal 'range'
      expect(m1.matchers[0].ranges).to.deep.equal [
        { begin:  97, end:  99 },
      ]
    it 'merges overlapping ranges', ->
      m1 = match"[a-fe-h]"
      expect(m1.type).to.equal 'chain'
      expect(m1.matchers.length).to.equal 1
      
      expect(m1.matchers[0].type).to.equal 'range'
      expect(m1.matchers[0].ranges).to.deep.equal [
        { begin:  97, end: 104 },
      ]
    it 'sorts ranges', ->
      m1 = match"[e-ha-c]"
      expect(m1.type).to.equal 'chain'
      expect(m1.matchers.length).to.equal 1
      
      expect(m1.matchers[0].type).to.equal 'range'
      expect(m1.matchers[0].ranges).to.deep.equal [
        { begin:  97, end:  99 },
        { begin: 101, end: 104 },
      ]
    it 'normalizes ranges', ->
      m1 = match"[cdba-f321-9]"
      expect(m1.type).to.equal 'chain'
      expect(m1.matchers.length).to.equal 1
      
      expect(m1.matchers[0].type).to.equal 'range'
      expect(m1.matchers[0].ranges).to.deep.equal [
        { begin:  49, end:  57 },
        { begin:  97, end: 102 },
      ]
    it 'supports trailing dashes', ->
      m1 = match"[-]"
      expect(m1.type).to.equal 'chain'
      expect(m1.matchers.length).to.equal 1
      
      expect(m1.matchers[0].type).to.equal 'range'
      expect(m1.matchers[0].ranges).to.deep.equal [
        { begin:  45, end:  45 },
      ]
      
      m2 = match"[a-f-]"
      expect(m2.type).to.equal 'chain'
      expect(m2.matchers.length).to.equal 1
      
      expect(m2.matchers[0].type).to.equal 'range'
      expect(m2.matchers[0].ranges).to.deep.equal [
        { begin:  45, end:  45 },
        { begin:  97, end: 102 },
      ]
      
      m3 = match"[a-f_-]"
      expect(m3.type).to.equal 'chain'
      expect(m3.matchers.length).to.equal 1
      
      expect(m3.matchers[0].type).to.equal 'range'
      expect(m3.matchers[0].ranges).to.deep.equal [
        { begin:  45, end:  45 },
        { begin:  95, end:  95 },
        { begin:  97, end: 102 },
      ]
    it 'fails', ->
      expect(=> match"[-a]").to.throw()
      expect(=> match"[1-3-5]").to.throw()
  describe 'repeat', ->
    it '+', ->
      m1 = match"foo+"
      expect(m1.type).to.equal 'chain'
      expect(m1.matchers.length).to.equal 1
      
      expect(m1.matchers[0].type).to.equal 'repeat'
      expect(m1.matchers[0].range).to.deep.equal {min: 1, max: Infinity}
      expect(m1.matchers[0].matcher.type).to.equal 'literal'
      expect(m1.matchers[0].matcher.match).to.equal 'foo'
    it '*', ->
      m1 = match"foo*"
      expect(m1.type).to.equal 'chain'
      expect(m1.matchers.length).to.equal 1
      
      expect(m1.matchers[0].type).to.equal 'repeat'
      expect(m1.matchers[0].range).to.deep.equal {min: 0, max: Infinity}
      expect(m1.matchers[0].matcher.type).to.equal 'literal'
      expect(m1.matchers[0].matcher.match).to.equal 'foo'
    it '?', ->
      m1 = match"foo?"
      expect(m1.type).to.equal 'chain'
      expect(m1.matchers.length).to.equal 1
      
      expect(m1.matchers[0].type).to.equal 'repeat'
      expect(m1.matchers[0].range).to.deep.equal {min: 0, max: 1}
      expect(m1.matchers[0].matcher.type).to.equal 'literal'
      expect(m1.matchers[0].matcher.match).to.equal 'foo'
    it '{x, y}', ->
      m1 = match"foo{1,2}"
      expect(m1.type).to.equal 'chain'
      expect(m1.matchers.length).to.equal 1
      
      expect(m1.matchers[0].type).to.equal 'repeat'
      expect(m1.matchers[0].range).to.deep.equal {min: 1, max: 2}
      expect(m1.matchers[0].matcher.type).to.equal 'literal'
      expect(m1.matchers[0].matcher.match).to.equal 'foo'
  it 'with arguments', ->
    m1 = match"foo#{'bar'}#{3}"
    expect(m1.type).to.equal 'chain'
    expect(m1.matchers.length).to.equal 1
    
    expect(m1.matchers[0].type).to.equal 'literal'
    expect(m1.matchers[0].match).to.equal 'foobar3'
    
    m2 = match"foo #{match.raw"\n"}"
    expect(m2.type).to.equal 'chain'
    expect(m2.matchers.length).to.equal 2
    
    expect(m2.matchers[0].type).to.equal 'literal'
    expect(m2.matchers[0].match).to.equal 'foo'
    
    expect(m2.matchers[1].type).to.equal 'chain'
    expect(m2.matchers[1].matchers.length).to.equal 1
    expect(m2.matchers[1].matchers[0].type).to.equal 'literal'
    expect(m2.matchers[1].matchers[0].match).to.equal '\n'
