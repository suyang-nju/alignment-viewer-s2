import { Shape, registerBBox, getBBoxMethod } from '@antv/g-canvas'
import { isNil, isArray } from 'lodash'

import type { TColorEntry } from "./AlignmentColorSchema"
import type { TPssm, TAlignmentPositionsToStyle } from "./Alignment"

registerBBox("sequenceLogo", getBBoxMethod("image"))

export const ShapeBaseSupportingSequenceLogo = Object.create(Shape)

type TSequenceLogosAttrs = {
  x: number,
  y: number,
  width: number,
  height: number,
  pssm: TPssm,
  logoWidth: number,
  logoHeight: number,
  fontSize: number,
  fontFamily: string,
  fontWidth: number,
  fontActualBoundingBoxAscents: number[],
  fontActualBoundingBoxDescents: number[],
  colorPalette: Map<string, TColorEntry>,
  defaultTextColor: string, 
  backgroundColor: string,
  compareToSequence: string,
  positionsToStyle: TAlignmentPositionsToStyle,
}


export class SequenceLogoShape extends Shape.Image {
  getShapeBase(): typeof Shape {
    return ShapeBaseSupportingSequenceLogo
  }

  createPath(context: CanvasRenderingContext2D): void {
    const {
      pssm,
      width: logoWidth, 
      height: logoHeight, 
      fontSize, 
      fontFamily, 
      fontWidth,
      fontActualBoundingBoxAscents, 
      fontActualBoundingBoxDescents,
      colorPalette, 
      defaultTextColor,
      backgroundColor,
      compareToSequence, 
      positionsToStyle, 
     }: TSequenceLogosAttrs = this.attr()

     const { x, y }: {x: number, y: number} = this.attr()

     context.fillStyle = backgroundColor
     context.fillRect(x, y, logoWidth, logoHeight)

     context.save()

     context.font = `${fontSize}px ${fontFamily}`

     
     context.resetTransform()
     const alphabet = pssm.alphabet

     const indexingOffset = sequencePosition * pssm.numSymbols
     let y = logoHeight
     const x = dpr * (logoWidth - fontWidth)/2
     for (let i = 0; i < pssm.numSymbols; ++i) {
       const j = pssm.sortedIndices[indexingOffset + i]
       if (j === pssm.numSymbols - 1) { // gap
         continue
       }
 
       const percentage = pssm.values[indexingOffset + j]
       if (percentage <= 0) {
         continue
       }
 
       if (
         (((positionsToStyle === "sameAsReference") || (positionsToStyle === "sameAsConsensus")) && (alphabet[j] !== compareToSequence[sequencePosition])) ||
         (((positionsToStyle === "differentFromReference") || (positionsToStyle === "differentFromConsensus")) && (alphabet[j] === compareToSequence[sequencePosition]))
       ) {
         continue
       }
       
       const letterHeight = logoHeight * percentage / 100
       context.fillStyle = colorPalette.get(alphabet[j])?.color ?? defaultTextColor
       const paddingBottom = 5 / letterHeight
       // const paddingBottom = 2 / Math.sqrt(letterHeight)
       // const k = 1/256
       // const paddingBottom = (Math.sqrt(letterHeight * letterHeight + 2 * k) - letterHeight) / k
       const scaleY = letterHeight / (fontActualBoundingBoxAscents[j] + fontActualBoundingBoxDescents[j] + paddingBottom)
       y -= scaleY * (fontActualBoundingBoxDescents[j] + paddingBottom)
       context.setTransform(dpr, 0, 0, dpr * scaleY, x, y * dpr)
       context.fillText(alphabet[j], 0, 0)
       y -= scaleY * fontActualBoundingBoxAscents[j]  
     }
 
  }

}
// Shape.OffscreenCanvas = OffscreenCanvasShape

ShapeBaseSupportingSequenceLogo.SequenceLogo = SequenceLogoShape
