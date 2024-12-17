import type { Ignore } from 'ignore'
import fs from 'node:fs'
import path from 'node:path'
import chalk from 'chalk'
import ignore from 'ignore'
import pLimit from 'p-limit'
import Progress from 'progress'
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

function filterEmptyValues(arr: string[]): string[] {
  return arr.filter(value => value.trim() !== '')
}

function parseOptions(options: Options): Required<Options> {
  const ops: Required<Options> = Object.assign({}, DEFAULT_OPTIONS, options)
  if (ops.src === undefined || ops.src.trim() === '') {
    ops.src = '.'
  }
  ops.fileNames = filterEmptyValues(ops.fileNames)
  ops.ruleSupplements = filterEmptyValues(ops.ruleSupplements)
  ops.threads = Math.max(ops.threads, 1)

  if (!fs.existsSync(ops.src)) {
    throw new Error(`Source directory "${ops.src}" does not exist.`)
  }
  return ops
}

function initIgnore(folderPath: string, fileNames: string[], ruleSupplements: string[]): Ignore {
  const ig = ignore({ allowRelativePaths: true })
  for (const fileName of fileNames) {
    const filePath = path.join(folderPath, fileName)
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      ig.add(fs.readFileSync(filePath, 'utf8').toString())
    }
  }
  return ig.add(ruleSupplements)
}

interface FileInfo {
  path: string
  isFile: boolean
}

function fileScanner(folderPath: string, paths: string[], fileNames: string[], ruleSupplements: string[]): FileInfo[] {
  const files: FileInfo[] = []
  const ig = initIgnore(folderPath, fileNames, ruleSupplements)

  for (const file of fs.readdirSync(folderPath, { withFileTypes: true })) {
    const fullPath = path.join(...paths, file.name)
    if (file.isDirectory() && !ig.ignores(`${file.name}/`)) {
      files.push({
        path: `${fullPath}/`,
        isFile: false,
      })
      files.push(
        ...fileScanner(
          path.join(folderPath, file.name),
          paths.concat([file.name]),
          fileNames,
          ruleSupplements,
        ),
      )
    }
    else if (file.isFile() && !ig.ignores(file.name)) {
      files.push({
        path: fullPath,
        isFile: true,
      })
    }
  }

  return files.filter(file => !ig.ignores(file.path))
}

interface ProgressBar {
  (options: { file: string, stat: string }): void
}

function createProgressBar(total: number, enabled: boolean): ProgressBar {
  const progress = new Progress(':stat :percent :etas :file', { total })

  return function (options: { file: string, stat: string }) {
    if (enabled) {
      progress.tick(options)
    }
  }
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

function cpFile(options: Required<Options>, file: FileInfo, progressBar: ProgressBar): CpFile {
  const src = path.join(options.src, file.path)
  const dist = path.join(options.dist, file.path)
  progressBar({ stat: chalk.green('Copying'), file: chalk.gray(file.path) })

  if (file.isFile) {
    fs.mkdirSync(path.dirname(dist), { recursive: true })
    fs.copyFileSync(src, dist)
  }
  else if (options.keepEmptyFolder) {
    fs.mkdirSync(dist, { recursive: true })
  }

  return { src, dist }
}

/**
 * Copy files with ignore rules
 * @param options Options
 * @returns Copied files information
 */
export default async function cpignore(options: Options): Promise<CpFile[]> {
  const ops = parseOptions(options)

  if (!fs.existsSync(ops.dist)) {
    fs.mkdirSync(ops.dist, { recursive: true })
  }

  const files = fileScanner(ops.src, [], ops.fileNames, ops.ruleSupplements)
  const progressBar = createProgressBar(files.length + 1, ops.log)

  const limit = pLimit(ops.threads)
  const cpJobs = files.map(file => limit(cpFile, ops, file, progressBar))
  const cpFiles = await Promise.all(cpJobs)

  progressBar({ stat: chalk.green('Done'), file: '' })
  return cpFiles
}
