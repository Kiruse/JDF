{Assertion} = require 'chai'

Assertion.addMethod 'lookLike', asserter = (template) ->
  @assert lookslike(@_obj, template),
    'expected #{this} to look like #{exp}',
    'expected #{this} to not look like #{exp}',
    template
Assertion.addMethod 'looksLike', asserter

lookslike = (act, exp) ->
  switch
    when typeof exp isnt 'object'
      return exp is act
    when Array.isArray exp
      return false unless Array.isArray(act) and act.length >= exp.length
      for elExp in exp
        return false unless act.find (elAct) => lookslike elAct, elExp
      return true
    else
      for prop of exp
        return false unless lookslike act[prop], exp[prop]
      return true
