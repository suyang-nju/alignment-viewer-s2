import type { TAlignment } from '../lib/Alignment'

import { expose } from 'threads/worker'
// const { expose } = require('threads/worker')
import { createAlingmentFromSequences, createAlingmentFromText } from '../lib/Alignment'

const getKeys = Object.keys as <T extends object>(obj: T) => Array<keyof T>

function generateRawData(row: {level1: number, level2: number}, col: {level3: number, level4: number}) {
  // console.log("Begin randome", Date.now())
  const res = []

  const rowKeys = getKeys(row)
  const colKeys = getKeys(col)

  let sn = 0
  for (let i = 0; i < row[rowKeys[0]]; i++) {
    for (let j = 0; j < row[rowKeys[1]]; j++) {
      for (let m = 0; m < col[colKeys[0]]; m++) {
        for (let n = 0; n < col[colKeys[1]]; n++) {
          ++sn
          res.push({
            id: `${sn}`,
            __actualId__: `${sn}`,
            level1: `level1:${i}`,
            level2: `level2:${j}`,
            level3: `level3:${m}`,
            level4: `level4:${n}`,
            sequence: "ACDEFGHIKLMNPQRSTVWY-"[sn % 21].repeat(315),
            __sequenceIndex__: sn - 1,
            __links__: []
          })
        }
      }
    }
  }

  // console.log("Done randome", Date.now())
  return res
}

async function fetcher(fileOrUrl?:File | string) {
  // console.log("Begin fetching in remoteFetcher", Date.now())
  let alignment: TAlignment | undefined
  if (fileOrUrl === "random") {
    alignment = createAlingmentFromSequences("random", generateRawData(
      { level1: 100, level2: 10 },
      { level3: 100, level4: 10 },
    ))
  } else {
    let text: string
    if (typeof fileOrUrl === "string") {
      const response = await fetch(fileOrUrl)
      text = await response.text()
    } else {
      // await new Promise((resolve) => setTimeout(resolve, 5000))
      text = await fileOrUrl.text()
    }
    alignment = createAlingmentFromText(fileOrUrl?.name || "", text)
  }
  // console.log("Done fetching in remoteFetcher", Date.now())
  return alignment
}

expose(fetcher)

