import type { Ignore } from 'ignore'
import type { LimitFunction } from 'p-limit'
import fs from 'node:fs'
import path from 'node:path'
import chalk from 'chalk'
import ignore from 'ignore'
import pLimit from 'p-limit'
import { stdout } from 'single-line-log'
import { version } from '../package.json'

export const VERSION: string = version

/**
 * Options for cpignore
 */
export interface Options {
  /**
   * Source directory
   *
   * @default '.'
   */
  src?: string
  /**
   * Destination directory
   *
   * @required
   */
  dist: string
  /**
   * Ignore file names
   *
   * @default ['.gitignore']
   */
  fileNames?: string[]
  /**
   * Ignore rule supplements
   *
   * @default ['.git']
   */
  ruleSupplements?: string[]
  /**
   * Keep empty folder
   *
   * @default true
   */
  keepEmptyFolder?: boolean
  /**
   * Copy file threads
   *
   * @default 10
   */
  threads?: number
  /**
   * Log enabled
   *
   * @default false
   */
  log?: boolean
}

/**
 * Default options
 */
export const DEFAULT_OPTIONS: Required<Options> = {
  src: '.',
  dist: '',
  fileNames: ['.gitignore'],
  ruleSupplements: ['.git'],
  keepEmptyFolder: true,
  threads: 10,
  log: false,
}

/**
 * Copy file information
 */
export interface CpFile {
  /**
   * Source file path
   */
  src: string
  /**
   * Destination file path
   */
  dist: string
}

function filterEmptyValues(arr: string[]): string[] {
  return arr.filter(value => value.trim() !== '')
}

interface LineLogger {
  (message: string): void
  end: () => void
}

function createLineLogger(enabled: boolean): LineLogger {
  function logger(message: string) {
    if (enabled) {
      stdout.clear()
      stdout(message)
    }
  }

  return Object.assign(logger, {
    end: () => enabled && console.log(''),
  })
}

export class Cpignore {
  private options: Required<Options>
  private limit: LimitFunction
  private cpJobs: Promise<CpFile>[]
  private gIgnore: Ignore | null = null
  private lineLogger: LineLogger

  constructor(options: Options) {
    this.options = this.parseOptions(options)
    this.limit = pLimit(this.options.threads)
    this.cpJobs = []
    this.lineLogger = createLineLogger(this.options.log)
    if (this.options.ruleSupplements.length > 0) {
      this.gIgnore = ignore({ allowRelativePaths: true })
        .add(this.options.ruleSupplements)
    }
  }

  parseOptions(options: Options): Required<Options> {
    const ops: Required<Options> = Object.assign({}, DEFAULT_OPTIONS, options)
    if (ops.src === undefined || ops.src.trim() === '') {
      ops.src = '.'
    }
    ops.fileNames = filterEmptyValues(ops.fileNames)
    ops.ruleSupplements = filterEmptyValues(ops.ruleSupplements)
    ops.threads = Math.max(ops.threads, 1)
    return ops
  }

  checkOptions(): void {
    if (!fs.existsSync(this.options.src)) {
      throw new Error(`Source directory "${this.options.src}" does not exist.`)
    }
  }

  initIgnore(folderPath: string): Ignore | null {
    if (this.options.fileNames.length === 0) {
      return null
    }

    const patterns: string[] = []
    for (const fileName of this.options.fileNames) {
      const filePath = path.join(folderPath, fileName)
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        patterns.push(fs.readFileSync(filePath, 'utf8').toString())
      }
    }
    if (patterns.length === 0) {
      return null
    }

    const ig = ignore({ allowRelativePaths: true })
    patterns.forEach(pattern => ig.add(pattern))
    return ig
  }

  checkIgnore(filePath: string, ignores: Ignore[]): boolean {
    return (this.gIgnore ? [this.gIgnore, ...ignores] : ignores)
      .some(ignore => ignore.ignores(filePath))
  }

  copyFile = (filePath: string, isFile: boolean) => {
    const src = path.join(this.options.src, filePath)
    const dist = path.join(this.options.dist, filePath)
    this.lineLogger(`${chalk.blueBright('Copying')}: ${chalk.gray(filePath)}`)

    if (isFile) {
      fs.mkdirSync(path.dirname(dist), { recursive: true })
      fs.copyFileSync(src, dist)
    }
    else if (this.options.keepEmptyFolder) {
      fs.mkdirSync(dist, { recursive: true })
    }
    return { src, dist }
  }

  walkFolder(folderPath: string, paths: string[], parentIgnores: Ignore[]): void {
    const ig = this.initIgnore(folderPath)
    const ignores = parentIgnores.concat([])
    ig && ignores.unshift(ig)

    const files = fs.readdirSync(folderPath, { withFileTypes: true })
    for (const file of files) {
      const isDirectory = file.isDirectory()
      const isFile = file.isFile()
      if (!isDirectory && !isFile) {
        // Ignore non-file and non-directory items
        continue
      }
      const fPath = path.join(...paths, file.name) + (isDirectory ? '/' : '')

      if (this.checkIgnore(fPath, ignores)) {
        continue
      }
      const job = this.limit(this.copyFile, fPath, isFile)
      this.cpJobs.push(job)
      if (isDirectory) {
        this.walkFolder(
          path.join(folderPath, file.name),
          paths.concat([file.name]),
          ignores,
        )
      }
    }
  }

  async run(): Promise<CpFile[]> {
    this.checkOptions()
    if (!fs.existsSync(this.options.dist)) {
      fs.mkdirSync(this.options.dist, { recursive: true })
    }
    this.walkFolder(this.options.src, [], [])
    const cpFiles = await Promise.all(this.cpJobs)
    this.lineLogger(chalk.green(`Copied ${cpFiles.length} files.`))
    this.lineLogger.end()
    return cpFiles
  }
}
