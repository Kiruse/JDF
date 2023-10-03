import CoffeeScriptPlugin from 'bun-coffeescript'

Bun.build
  target: 'browser'
  entrypoints: ['src/index.ts']
  plugins: [CoffeeScriptPlugin()]
  outdir: 'dist'
  define:
    'process.env.ENV': '"DEV"'
