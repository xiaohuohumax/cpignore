import type { CpFile, Options } from './cpignore'
import { version } from '../package.json'
import { Cpignore } from './cpignore'

export const VERSION: string = version
export * from './cpignore'

/**
 * Copy files with ignore rules
 * @param options Options
 * @returns Copied files information
 */
export default async function (options: Options): Promise<CpFile[]> {
  return new Cpignore(options).run()
}
