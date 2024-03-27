import type { Event as GraphEvent } from '@antv/g-canvas'
import type { S2CellType, ViewMeta } from '@antv/s2'
import type { TContextualInfo } from '../types'

import { isNumber } from 'lodash'

import { isGapChar } from '../sequence'
import { shouldBeStyledFactory } from '../alignment'
import { TableDataCellWithEventsAndSequence } from './base'

export class SequenceDataCell extends TableDataCellWithEventsAndSequence {
  drawSpecificContent(sequencePositionStart: number, sequencePositionEnd: number): void {
    const spreadsheet = this.spreadsheet
    const avStore = spreadsheet.avStore
    const alignment = avStore.alignment
    if (!alignment) {
      return
    }

    const dimensions = avStore.dimensions
    const { residueWidth, residueHeight } = dimensions
    const { x: cellX, y: cellY, height: cellHeight } = this.getCellArea()
    const sequenceIndex = this.getMeta().fieldValue
    const img = this.spriteShape.attr('img') as (OffscreenCanvas | ImageData | undefined)[]
    
    if (sequenceIndex === "$$overview$$") {
      const visibleSequenceRowIndexStart = spreadsheet.visibleSequenceRowIndexStart
      const visibleSequenceRowIndexEnd = spreadsheet.visibleSequenceRowIndexEnd
      // this.spriteShape.attr({
      //   sx: sequencePositionStart,
      //   sy: visibleSequenceRowIndexStart,
      //   sWidth: sequencePositionEnd - sequencePositionStart + 1,
      //   sHeight: visibleSequenceRowIndexEnd - visibleSequenceRowIndexStart + 1,
      //   dx: Math.round(cellX + sequencePositionStart * residueWidth),
      //   dy: Math.round(cellY + visibleSequenceRowIndexStart * residueHeight),
      //   dWidth: residueWidth * (sequencePositionEnd - sequencePositionStart + 1),
      //   dHeight: residueHeight * (visibleSequenceRowIndexEnd - visibleSequenceRowIndexStart + 1),
      // })
      // img[0] = avStore.get("minimapImage") as OffscreenCanvas

      const sWidth = sequencePositionEnd - sequencePositionStart + 1
      const sHeight = visibleSequenceRowIndexEnd - visibleSequenceRowIndexStart + 1
      if (!(
        (img[0] instanceof OffscreenCanvas) &&
        (img[0].width >= sWidth) &&
        (img[0].height >= sHeight)
      )) {
        img[0] = new OffscreenCanvas(sWidth, sHeight)
      }

      const overviewImageData = avStore.overviewImageData
      if (!overviewImageData) {
        return
      }

      const ctx = img[0].getContext("2d")
      ctx?.putImageData(overviewImageData, -sequencePositionStart, -visibleSequenceRowIndexStart, sequencePositionStart, visibleSequenceRowIndexStart, sWidth, sHeight)
      this.spriteShape.attr({
        sx: 0,
        sy: 0,
        sWidth,
        sHeight,
        dx: Math.round(cellX + sequencePositionStart * residueWidth),
        dy: Math.round(cellY + visibleSequenceRowIndexStart * residueHeight),
        dWidth: residueWidth * (sequencePositionEnd - sequencePositionStart + 1),
        dHeight: residueHeight * (visibleSequenceRowIndexEnd - visibleSequenceRowIndexStart + 1),
      })
    } else {
      const sprites = avStore.sprites
      const dpr = window.devicePixelRatio
      this.spriteShape.attr({
        // cursor: "text",
        sx: 0,
        sy: 0,
        sWidth: sprites.props.width * dpr,
        sHeight: sprites.props.height * dpr,
        dx: Math.round(cellX + sequencePositionStart * residueWidth),
        dy: Math.round(cellY + Math.round((cellHeight - sprites.props.height)/2)),
        dWidth: sprites.props.width,
        dHeight: sprites.props.height,
        skipX: residueWidth,
      })

      let sequence: string
      if (sequenceIndex === "$$reference$$") {
        sequence = alignment.sequences[alignment.referenceSequenceIndex]
      } else if (sequenceIndex === "$$consensus$$") {
        sequence = alignment.positionalAnnotations.consensus
      } else {
        sequence = alignment.sequences[sequenceIndex as number]
      }

      let positionsToStyle = avStore.positionsToStyle
      if (
        ((sequenceIndex === "$$reference$$") && ((positionsToStyle === "sameAsReference") || (positionsToStyle === "differentFromReference"))) || 
        ((sequenceIndex === "$$consensus$$") && ((positionsToStyle === "sameAsConsensus") || (positionsToStyle === "differentFromConsensus")))
      ) {
        positionsToStyle = "all"
      }

      const shouldBeStyled = shouldBeStyledFactory(
        positionsToStyle,
        alignment.sequences[alignment.referenceSequenceIndex], 
        alignment.positionalAnnotations.consensus,
        alignment.alphabetToPssmIndex,
      )

      const hideUnstyledPositions = avStore.hideUnstyledPositions
  
      for (let i = sequencePositionStart, j = 0; i <= sequencePositionEnd; ++i, ++j) {
        img[j] = shouldBeStyled(sequence[i], i) ? sprites.get(sequence[i]) : hideUnstyledPositions ? undefined : sprites.getMuted(sequence[i])
      }
    }
  }
  
  /*
  drawSpecificContent(sequencePositionStart: number, sequencePositionEnd: number): void {
    const sequenceIndex = this.getMeta().fieldValue
    if (sequenceIndex === "$$overview$$") {
      this.drawSpecificContentOverview(sequencePositionStart, sequencePositionEnd)
    } else {
      this.drawSpecificContentNormal(sequencePositionStart, sequencePositionEnd)
    }
  }

  drawSpecificContentNormal(sequencePositionStart: number, sequencePositionEnd: number): void {
    const canvas = this.backgroundShape.attr('img') as OffscreenCanvas
    const ctx = canvas.getContext("2d")
    if (!!!ctx) {
      return
    }
    // ctx.resetTransform()
    // ctx.imageSmoothingEnabled = false

    const avStore = (this.spreadsheet as AVTableSheet).avStore
    const sprites = avStore.get("sprites") as Sprites
    const dimensions = avStore.get("dimensions") as TDimensions
    const { residueWidth } = dimensions
    const dpr = window.devicePixelRatio
    const visibleSequencePositionStart = (this.spreadsheet as AVTableSheet).visibleSequencePositionStart
    const alignment = avStore.get("alignment") as TAlignment
    
    const sequenceIndex = this.getMeta().fieldValue
    let sequence: string
    if (sequenceIndex === "$$overview$$") { // should never reach here
      return
    } else if (sequenceIndex === "$$reference$$") {
      sequence = alignment.referenceSequence?.sequence
    } else if (sequenceIndex === "$$consensus$$") {
      sequence = alignment.positionalAnnotations.consensus?.sequence
    } else {
      sequence = alignment.sequences[sequenceIndex as number].sequence
    }
    sequence = sequence.substring(sequencePositionStart, sequencePositionEnd + 1)

    let style = avStore.get("positionsToStyle") as TAlignmentPositionsToStyle
    if (
      ((sequenceIndex === "$$reference$$") && ((style === "sameAsReference") || (style === "differentFromReference"))) || 
      ((sequenceIndex === "$$consensus$$") && ((style === "sameAsConsensus") || (style === "differentFromConsensus")))
    ) {
      style = "all"
    }
    const mask = formatSequence(
      sequence, 
      style, 
      alignment.referenceSequence.sequence.substring(sequencePositionStart, sequencePositionEnd + 1), 
      alignment.positionalAnnotations.consensus.sequence.substring(sequencePositionStart, sequencePositionEnd + 1)
    )

    let dx = residueWidth * dpr * (sequencePositionStart - visibleSequencePositionStart)
    const dy = Math.round((this.renderingHeight - sprites.props.height * dpr)/2)
    for (let i = 0; i < mask.length; ++i) {
      if (mask[i]) {
        ctx.drawImage(sprites.get(sequence[i]), dx, dy)
      }
      dx += residueWidth * dpr
    }
  }

  drawSpecificContentOverview(sequencePositionStart: number, sequencePositionEnd: number): void {
    const canvas = this.backgroundShape.attr('img') as OffscreenCanvas
    const ctx = canvas.getContext("2d")
    if (!!!ctx) {
      return
    }
    // ctx.resetTransform()
    // ctx.imageSmoothingEnabled = false

    const sequenceIndex = this.getMeta().fieldValue
    const dpr = window.devicePixelRatio
    const avStore = (this.spreadsheet as AVTableSheet).avStore
    const dimensions = avStore.get("dimensions") as TDimensions
    const { residueWidth, residueHeight } = dimensions
    const minimapImage = avStore.get("minimapImage") as OffscreenCanvas
    const visibleSequencePositionStart = (this.spreadsheet as AVTableSheet).visibleSequencePositionStart
    const visibleSequenceRowIndexStart = (this.spreadsheet as AVTableSheet).visibleSequenceRowIndexStart
    const visibleSequenceRowIndexEnd = (this.spreadsheet as AVTableSheet).visibleSequenceRowIndexEnd
    
    if (sequenceIndex === "$$overview$$") {
      ctx.drawImage(
        minimapImage,
        sequencePositionStart,
        visibleSequenceRowIndexStart,
        sequencePositionEnd - sequencePositionStart + 1,
        visibleSequenceRowIndexEnd - visibleSequenceRowIndexStart + 1,
        (sequencePositionStart - visibleSequencePositionStart) * residueWidth * dpr,
        0,
        (sequencePositionEnd - sequencePositionStart + 1) * residueWidth * dpr,
        (visibleSequenceRowIndexEnd - visibleSequenceRowIndexStart + 1) * residueHeight * dpr,
      )  
    }
  }
  */

  getContextualInfo(event: GraphEvent, target: S2CellType, viewMeta: ViewMeta, iconName?: string): TContextualInfo | undefined {
    const alignment = this.spreadsheet.avStore.alignment
    if (!alignment) {
      return
    }

    const info = super.getContextualInfo(event, target, viewMeta, iconName)
    if (!info) {
      return
    }

    const residueIndex = info.residueIndex
    let sequenceIndex = info.sequenceIndex
    if (sequenceIndex === "$$reference$$") {
      sequenceIndex = alignment.referenceSequenceIndex
    }

    let sequence: string | undefined = undefined
    if (sequenceIndex === "$$consensus$$") {
      sequence = alignment.positionalAnnotations.consensus
    } else if (isNumber(sequenceIndex)) {
      sequence = alignment.sequences[sequenceIndex]
    }

    let residue: string | undefined = undefined
    if ((sequence !== undefined) && (residueIndex !== undefined)) {
      residue = sequence[residueIndex]
    }
    
    if ((residue === undefined) || (sequence === undefined) || (residueIndex === undefined)) {
      return info
    }

    info.content = []
    if (isGapChar(residue)) {
      return info
    }

    let residueNumber: number | string
    if (sequenceIndex === "$$consensus$$") {
      residueNumber = residueIndex + 1
    } else {
      residueNumber = alignment.annotations.__begin__[sequenceIndex as number] - 1
      for (let i = 0; i <= residueIndex; ++i) {
        if (!isGapChar(sequence[i])) {
          ++residueNumber
        }
      }  
    }

    info.content.push(<div key="residue" className="residue">{`${residue} ${residueNumber}`}</div>)
    return info
  }
}
