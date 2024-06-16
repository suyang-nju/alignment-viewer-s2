import type { TAlignment } from '../lib/types'

import { expose } from 'threads/worker'
// const { expose } = require('threads/worker')

import {
  createAlingmentFromSequenceRecords, 
  createAlingmentFromText
} from '../lib/Alignment'
import { getObjectKeys } from '../lib/utils'
import { createSequenceRecord } from '../lib/fasta'



function generateRandomAlignment(row: {level1: number, level2: number}, col: {level3: number, level4: number}) {
  // console.log("Begin randome", Date.now())
  const alphabet = "ACDEFGHIKLMNPQRSTVWY-"
  const length = 415

  const numTemplates = 5
  const templates = new Array(numTemplates)
  for (let i = 0; i < numTemplates; ++i) {
    templates[i] = new Array(length)
    for (let j = 0; j < length; ++j) {
      templates[i][j] = Math.floor(Math.random() * alphabet.length)
    }
  }

  const sequences = []
  const charArray = new Array(length)
  const rowKeys = getObjectKeys(row)
  const colKeys = getObjectKeys(col)
  let sn = 0
  for (let i = 0; i < row[rowKeys[0]]; i++) {
    for (let j = 0; j < row[rowKeys[1]]; j++) {
      for (let m = 0; m < col[colKeys[0]]; m++) {
        for (let n = 0; n < col[colKeys[1]]; n++) {
          const which = Math.floor(Math.random() * 10000 % numTemplates)
          for (let k = 0; k < length; ++k) {
            charArray[k] = alphabet[(templates[which][k] + sn) % alphabet.length]
          }

          sequences.push(createSequenceRecord(
            sn, 
            `Seq${sn + 1}`, 
            `level1=${i} level2=${j} level3=${m} level4=${n}`, 
            charArray.join("")
          ))
          ++sn
        }
      }
    }
  }

  // console.log("Done randome", Date.now())
  return createAlingmentFromSequenceRecords("random", sequences, {})
}

async function fetcher(fileOrUrl?:File | string) {
  // console.log("Begin fetching in remoteFetcher", Date.now())
  if (!fileOrUrl) {
    return null
  }

  let alignment: TAlignment | null
  if (fileOrUrl === "random") {
    alignment = generateRandomAlignment({ level1: 10, level2: 10 }, { level3: 10, level4: 10 })
  } else {
    let text: string, name = ""
    if (typeof fileOrUrl === "string") {
      const response = await fetch(fileOrUrl)
      text = await response.text()
      name = fileOrUrl
    } else {
      // await new Promise((resolve) => setTimeout(resolve, 5000))
      text = await fileOrUrl.text()
      name = fileOrUrl.name
    }
    alignment = createAlingmentFromText(name, text)
  }
  // console.log("Done fetching in remoteFetcher", Date.now())
  return alignment
}

expose(fetcher)

