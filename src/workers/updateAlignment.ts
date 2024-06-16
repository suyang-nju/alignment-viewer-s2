import type {
  TAlignment, 
  TAlignmentSortParams,
  TAlignmentPositionsToStyle,
} from '../lib/Alignment'
import type {
  TAlignmentColorMode, 
  TColorEntry, 
  TAlignmentColorPalette
} from '../lib/AlignmentColorSchema'

import { range } from 'lodash'
import { expose } from 'threads/worker'
import { Transfer } from 'threads'
// const { expose } = require('threads/worker')
// const { Transfer } = require('threads')

import {
  setReferenceSequence,
  groupByField,
  sortAlignment,
  formatSequence,
} from '../lib/Alignment'

function downSample(fromSize: number, toSize: number): number[] {
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
  groupBy: string | undefined,
  positionsToStyle: TAlignmentPositionsToStyle,
  alignmentColorPalette: TAlignmentColorPalette,
  alignmentColorMode: TAlignmentColorMode,
  maxMinimapWidth: number,
  maxMinimapHeight: number,
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
  if (tasks.includes("minimap")) {
    const palette = (alignmentColorMode === "Light") ? alignmentColorPalette["Light"] : alignmentColorPalette["Dark"]
    overviewBuffer = new ArrayBuffer(alignment.length * alignment.depth * 4)
    const overviewPixels = new Uint8ClampedArray(overviewBuffer)
    let k = 0
    for (let i = 0; i < sortedIndices.length; ++i) {
      const sequence = alignment.sequences[sortedIndices[i]].sequence
      const mask = formatSequence(
        sequence, 
        positionsToStyle, 
        alignment.referenceSequence.sequence, 
        alignment.consensusSequence.sequence
      )
      for (let j = 0; j < mask.length; ++j) {
        const rgba = mask[j] ? (palette.get(sequence[j])?.rgba) : undefined
        if (rgba) {
          overviewPixels[k++] = rgba[0]
          overviewPixels[k++] = rgba[1]
          overviewPixels[k++] = rgba[2]
          overviewPixels[k++] = rgba[3]
        } else {
          k += 4
        }
      }
    }
  
    if ((alignment.length > maxMinimapWidth) || (alignment.depth > maxMinimapHeight)) {
      const columnIndices = (alignment.length > maxMinimapWidth) ? downSample(alignment.length, maxMinimapWidth) : range(0, alignment.length)
      const rowIndices = (alignment.depth > maxMinimapHeight) ? downSample(alignment.depth, maxMinimapHeight) : range(0, alignment.depth)
      minimapBuffer = new ArrayBuffer(columnIndices.length * rowIndices.length * 4)
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
  ], transferrables)
}

expose(updateAlignment)
