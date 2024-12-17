import type { Options } from './cpignore'
import process from 'node:process'
import chalk from 'chalk'

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import cpignore, { DEFAULT_OPTIONS, VERSION } from './cpignore'

const args = hideBin(process.argv)

const cli = yargs(args)
  .locale('en')
  .scriptName('cpignore')
  .usage(`Welcome use $0 utility!\n\nUsage: $0 [options]`)
  .alias('v', 'version')
  .alias('h', 'help')
  .version(VERSION)
  .example('cpignore -s src -d dist', 'Copy files from "src" to "dist"')
  .epilogue('More information: https://github.com/xiaohuohumax/cpignore')
  .option('src', {
    type: 'string',
    description: 'Source directory',
    default: DEFAULT_OPTIONS.src,
    alias: 's',
  })
  .option('dist', {
    type: 'string',
    description: 'Destination directory',
    demandOption: true,
    alias: 'd',
  })
  .option('file-names', {
    type: 'array',
    description: 'Ignore file names',
    alias: 'f',
    default: DEFAULT_OPTIONS.fileNames,
  })
  .option('rule-supplements', {
    type: 'array',
    description: 'Ignore rule supplements',
    default: DEFAULT_OPTIONS.ruleSupplements,
    alias: 'r',
  })
  .option('keep-empty-folder', {
    type: 'boolean',
    description: 'Keep empty folder',
    default: DEFAULT_OPTIONS.keepEmptyFolder,
    alias: 'k',
  })
  .option('threads', {
    type: 'number',
    description: 'Copy file threads',
    default: DEFAULT_OPTIONS.threads,
    alias: 't',
  })
  .option('log', {
    type: 'boolean',
    description: 'Log enabled',
    default: DEFAULT_OPTIONS.log,
    alias: 'l',
  })

if (args.length === 0) {
  cli.showHelp()
  process.exit(0)
}

cpignore(cli.parse() as Options).catch((error) => {
  console.log(chalk.red(error.message))
  process.exit(1)
})
