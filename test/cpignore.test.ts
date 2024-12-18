import fs from 'node:fs'
import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import cpignore from '../packages/cpignore/src/index'

const src = path.join(__dirname, 'source')
const dist = path.join(__dirname, 'dist')

describe('cpignore', () => {
  beforeEach(() => {
    if (fs.existsSync(dist)) {
      fs.rmdirSync(dist, { recursive: true })
    }
  })

  it('test copy', async () => {
    await cpignore({
      src,
      dist,
      fileNames: ['.cpignore'],
    })
    expect(fs.readdirSync(dist)).toEqual(
      expect.arrayContaining(['.cpignore', 'b.txt']),
    )
    expect(fs.readdirSync(path.join(dist, 'item'))).toEqual(
      expect.arrayContaining(['.cpignore', 'd.txt']),
    )
  })

  it('test rule supplements', async () => {
    await cpignore({
      src,
      dist,
      ruleSupplements: ['*'],
    })
    expect(fs.readdirSync(dist).length).toEqual(0)
  })

  it('test remove empty folder', async () => {
    await cpignore({
      src,
      dist,
      fileNames: ['.cpignore'],
      keepEmptyFolder: false,
      ruleSupplements: ['item/*'],
    })
    expect(fs.readdirSync(dist)).toEqual(
      expect.arrayContaining(['.cpignore', 'b.txt']),
    )
    expect(fs.existsSync(path.join(dist, 'item'))).toEqual(false)
  })

  it('test source file not exist', async () => {
    const errorFn = vi.fn(error => error.message)
    await cpignore({
      src: '__empty__',
      dist: '__dist__',
    }).catch(errorFn)

    expect(errorFn).toHaveBeenCalled()
    expect(errorFn.mock.results[0].value).toEqual('Source directory "__empty__" does not exist.')
  })
})
