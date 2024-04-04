import type {
  TAlignment, 
  TAlignmentSortParams,
  TAlignmentPositionsToStyle,
  TColorEntry,
} from '../lib/types'

import { range } from 'lodash'
import { expose } from 'threads/worker'
import { Transfer } from 'threads'
// const { expose } = require('threads/worker')
// const { Transfer } = require('threads')

import {
  setReferenceSequence,
  groupByField,
  sortAlignment,
  shouldBeStyledFactory,
} from '../lib/alignment'
import { scaleToFit } from '../lib/utils'

function downSample(fromSize: number, toSize: number): number[] {
  if (fromSize <= toSize) {
    return range(0, fromSize)
  }

  const sample: number[] = []
  for (let i = 0; i < toSize; ++i) {
    sample.push(Math.round((fromSize - 1) * i / (toSize - 1)))
  }
  return sample
}

function updateAlignment(
  tasks: Array<"setReference" | "group" | "sort" | "minimap">,
  alignment: TAlignment, 
  sortedIndices: number[],
  referenceSequenceIndex: number,
  sortBy: TAlignmentSortParams[],
  groupBy: string | number | false,
  positionsToStyle: TAlignmentPositionsToStyle,
  palette: Map<string, TColorEntry>,
  minimapWidth: number,
) {
  if (tasks.includes("setReference")) {
    setReferenceSequence(alignment, referenceSequenceIndex)
  }
  
  if (tasks.includes("group")) {
    groupByField(alignment, groupBy)
  }

  if (tasks.includes("sort")) {
    sortedIndices = sortAlignment(alignment, sortBy)
  }
  
  let overviewBuffer: ArrayBuffer | undefined = undefined
  let minimapBuffer: ArrayBuffer | undefined = undefined
  let minimapImageWidth: number | undefined = undefined
  let minimapImageHeight: number | undefined = undefined
  if (tasks.includes("minimap")) {
    overviewBuffer = new ArrayBuffer(alignment.length * alignment.depth * 4)
    const overviewPixels = new Uint8ClampedArray(overviewBuffer)
    const shouldBeStyled = shouldBeStyledFactory(
      positionsToStyle,
      alignment.sequences[alignment.referenceSequenceIndex], 
      alignment.positionalAnnotations.consensus,
      alignment.alphabetToPssmIndex
    )

    let k = 0
    for (let i = 0; i < sortedIndices.length; ++i) {
      const sequence = alignment.sequences[sortedIndices[i]]
      let rgba: number[] | undefined
      for (let j = 0; j < alignment.length; ++j) {
        if (shouldBeStyled(sequence[j], j) && (rgba = palette.get(sequence[j])?.rgba)) {
          overviewPixels[k++] = rgba[0]
          overviewPixels[k++] = rgba[1]
          overviewPixels[k++] = rgba[2]
          overviewPixels[k++] = rgba[3]  
        } else {
          k += 4
        }
      }
    }
  
    const minimapHeight = Math.ceil(alignment.depth / alignment.length * minimapWidth)
    if ((alignment.length > minimapWidth) || (alignment.depth > minimapHeight)) {
      const columnIndices = downSample(alignment.length, minimapWidth)
      const rowIndices = downSample(alignment.depth, minimapHeight)
      minimapImageWidth = columnIndices.length
      minimapImageHeight = rowIndices.length
      minimapBuffer = new ArrayBuffer(minimapImageWidth * minimapImageHeight * 4)
      const minimapPixels = new Uint8ClampedArray(minimapBuffer)
      let k = 0
      for (const i of rowIndices) {
        for (const j of columnIndices) {
          const m = 4 * (i * alignment.length + j)
          minimapPixels[k++] = overviewPixels[m]
          minimapPixels[k++] = overviewPixels[m + 1]
          minimapPixels[k++] = overviewPixels[m + 2]
          minimapPixels[k++] = overviewPixels[m + 3]
        }
      }
    }    
  }

  const transferrables = []
  if (overviewBuffer) {
    transferrables.push(overviewBuffer)
  }

  if (minimapBuffer) {
    transferrables.push(minimapBuffer)
  }

  return Transfer([
    alignment,
    sortedIndices,
    overviewBuffer,
    minimapBuffer,
    minimapImageWidth, 
    minimapImageHeight,
  ], transferrables)
}

expose(updateAlignment)
