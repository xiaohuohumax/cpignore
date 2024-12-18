import json from '@rollup/plugin-json'
import resolve from '@rollup/plugin-node-resolve'
import { defineConfig } from 'rollup'
import dts from 'rollup-plugin-dts'
import esbuild from 'rollup-plugin-esbuild'

const external = ['ignore', 'yargs', 'yargs/helpers', 'single-line-log', 'chalk', 'p-limit']

const plugins = [
  resolve(),
  esbuild(),
  json(),
]

const esmConfig = defineConfig({
  input: {
    index: 'src/cpignore.ts',
    cli: 'src/cli.ts',
  },
  external,
  plugins,
  output: {
    format: 'esm',
    dir: 'dist',
    entryFileNames: '[name].mjs',
  },
})

const cjsConfig = defineConfig({
  input: 'src/index.ts',
  external,
  plugins,
  output: [
    {
      format: 'cjs',
      dir: 'dist',
      exports: 'named',
      entryFileNames: 'index.cjs',
    },
  ],
})

const libDtsConfig = defineConfig({
  input: 'src/index.ts',
  external,
  plugins: plugins.concat(dts()),
  output: {
    format: 'esm',
    dir: 'dist',
    entryFileNames: 'index.d.ts',
  },
})

export default [esmConfig, cjsConfig, libDtsConfig]
