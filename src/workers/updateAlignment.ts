import type {
  TAlignment, 
  TAlignmentSortParams,
  TAlignmentFilters,
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
  filterAlignment,
  sortAlignment,
  shouldBeStyledFactory,
} from '../lib/Alignment'
// import { scaleToFit } from '../lib/utils'

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
  tasks: Array<"setReference" | "group" | "filter" | "sort" | "minimap">,
  alignment: TAlignment, 
  filteredSortedIndices: number[],
  referenceSequenceIndex: number,
  sortBy: TAlignmentSortParams[],
  groupBy: string | number | false,
  filterBy: TAlignmentFilters,
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

  if (tasks.includes("filter")) {
    filteredSortedIndices = filterAlignment(alignment, filterBy)
  }

  if (tasks.includes("sort")) {
    filteredSortedIndices = sortAlignment(alignment, sortBy, filteredSortedIndices)
  }
  
  const overviewWidth = alignment.length, overviewHeight = filteredSortedIndices.length
  let overviewBuffer: ArrayBuffer | null = null
  let minimapBuffer: ArrayBuffer | null = null
  let minimapImageWidth: number | undefined = undefined
  let minimapImageHeight: number | undefined = undefined
  if (tasks.includes("minimap")) {
    overviewBuffer = new ArrayBuffer(overviewWidth * overviewHeight * 4)
    const overviewPixels = new Uint8ClampedArray(overviewBuffer)
    const shouldBeStyled = shouldBeStyledFactory(
      positionsToStyle,
      alignment.sequences[alignment.referenceSequenceIndex], 
      alignment.positionalAnnotations.consensus,
      alignment.alphabetToPssmIndex
    )

    let k = 0
    for (let i = 0; i < overviewHeight; ++i) {
      const sequence = alignment.sequences[filteredSortedIndices[i]]
      let rgba: number[] | undefined
      for (let j = 0; j < overviewWidth; ++j) {
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
  
    const minimapHeight = Math.ceil(overviewHeight / overviewWidth * minimapWidth)
    if ((overviewWidth > minimapWidth) || (overviewHeight > minimapHeight)) {
      const columnIndices = downSample(overviewWidth, minimapWidth)
      const rowIndices = downSample(overviewHeight, minimapHeight)
      minimapImageWidth = columnIndices.length
      minimapImageHeight = rowIndices.length
      minimapBuffer = new ArrayBuffer(minimapImageWidth * minimapImageHeight * 4)
      const minimapPixels = new Uint8ClampedArray(minimapBuffer)
      let k = 0
      for (const i of rowIndices) {
        for (const j of columnIndices) {
          const m = 4 * (i * overviewWidth + j)
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
    filteredSortedIndices,
    overviewBuffer,
    minimapBuffer,
    minimapImageWidth, 
    minimapImageHeight,
  ], transferrables)
}

expose(updateAlignment)
