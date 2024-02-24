import type { TAlignment, TAlignmentPositionsToStyle } from '../lib/Alignment'
import type { TAlignmentColorMode, TColorEntry, TAlignmentColorPalette } from '../lib/AlignmentColorSchema'

import { formatSequence } from '../lib/Alignment'

import { expose } from 'threads/worker'
import { Transfer } from 'threads'
// const { expose } = require('threads/worker')
// const { Transfer } = require('threads')

function createMinimapImage(
  alignment: TAlignment, 
  sortedIndices: number[], 
  positionsToStyle: TAlignmentPositionsToStyle, 
  alignmentColorPalette: TAlignmentColorPalette, 
  alignmentColorMode: TAlignmentColorMode,
){
  const palette = (alignmentColorMode === "Light") ? alignmentColorPalette["Light"] : alignmentColorPalette["Dark"]
  const buffer = new ArrayBuffer(alignment.length * alignment.depth * 4)
  const pixels = new Uint8ClampedArray(buffer)
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
        pixels[k++] = rgba[0]
        pixels[k++] = rgba[1]
        pixels[k++] = rgba[2]
        pixels[k++] = rgba[3]
      } else {
        k += 4
      }
    }
  }
  return Transfer({
    width: alignment.length, 
    height: alignment.depth, 
    buffer
  }, [buffer])
}

expose(createMinimapImage)
