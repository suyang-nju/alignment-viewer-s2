import type { Event as GraphEvent } from '@antv/g-canvas'
import type { S2CellType, ViewMeta } from '@antv/s2'
import type { TContextualInfo, TSequenceLogos, TPssm } from '../types'

import { isNumber } from 'lodash'

import { SPECIAL_ROWS } from '../constants'
import { TableDataCellWithEventsAndSequence } from './base'

export class LogoDataCell extends TableDataCellWithEventsAndSequence {
  drawSpecificContent(sequencePositionStart: number, sequencePositionEnd: number): void {
    const avStore = this.spreadsheet.avStore
    const visibleSequencePositionStart = this.spreadsheet.visibleSequencePositionStart
    const alignment = avStore.alignment
    if (!alignment) {
      return
    }

    const sequenceIndex = this.getMeta().fieldValue as string | number
    let sequenceLogos: TSequenceLogos
    let groupIndex: number | undefined
    if (alignment.groupBy && isNumber(sequenceIndex)) {
      groupIndex = alignment.annotations.__groupIndex__[sequenceIndex]
      sequenceLogos = avStore.sequenceLogosGroups

    } else {
      groupIndex = undefined
      sequenceLogos = avStore.sequenceLogos
    }

    if (!sequenceLogos) {
      return
    }

    const dimensions = avStore.dimensions
    const { residueWidth } = dimensions
    const { x: cellX, y: cellY, height: cellHeight } = this.getCellArea()
    const dpr = window.devicePixelRatio

    this.spriteShape.attr({
      sx: 0,
      sy: 0,
      sWidth: sequenceLogos.props.width * dpr,
      sHeight: sequenceLogos.props.height * dpr,
      dx: Math.round(cellX + sequencePositionStart * residueWidth),
      dy: Math.round(cellY + (cellHeight - sequenceLogos.props.height)/2),
      dWidth: sequenceLogos.props.width,
      dHeight: sequenceLogos.props.height,
      skipX: residueWidth,
    })
  
    const img = this.spriteShape.attr('img') as (OffscreenCanvas | ImageData | undefined)[]
    if ((!this.renderedSequencePositionStart) || (this.renderedSequencePositionStart < sequencePositionStart)) {
      for (let i = sequencePositionStart, j = i - visibleSequencePositionStart; i <= sequencePositionEnd; ++i, ++j) {
        img[j] = sequenceLogos.get(i, groupIndex)
      }  
    } else {
      for (let i = sequencePositionEnd, j = i - visibleSequencePositionStart; i >= sequencePositionStart; --i, --j) {
        img[j] = sequenceLogos.get(i, groupIndex)
      }  
    }
  }

  getContextualInfo(event: GraphEvent, target: S2CellType, viewMeta: ViewMeta, iconName?: string): TContextualInfo | undefined {
    const alignment = this.spreadsheet.avStore.alignment
    if (!alignment) {
      return
    }

    const info = super.getContextualInfo(event, target, viewMeta, iconName)
    if (!info) {
      return
    }

    const residueIndex = info.residueIndex as number
    const sequenceIndex = info.sequenceIndex
    const key = `${sequenceIndex} ${residueIndex}`
    const className = `${sequenceIndex}`

    let pssm: TPssm
    if (isNumber(sequenceIndex)) {
      const groupIndex = alignment.annotations.__groupIndex__[sequenceIndex]
      pssm = alignment.groups[groupIndex].pssm//[residueIndex]
      // sortedIndices = alignment.groups[groupIndex].pssmSortedIndices[residueIndex]
    } else {
      pssm = alignment.positionalAnnotations.pssm//[residueIndex]
      // sortedIndices = alignment.pssmSortedIndices[residueIndex]
    }

    if (pssm) {
      info.content = []
      let lessThan1pct = ""
      const indexingOffset = residueIndex * pssm.alphabet.length
      for (let j = pssm.alphabet.length - 1; j >= 0; --j) {
        const i = pssm.sortedIndices[indexingOffset + j]
        const pct = pssm.values[indexingOffset + i]
        if ((i === pssm.gapIndex) || (pct < 0)) { // gap or not exist
          continue
        } else if (pct > 0) {
          info.content.push(
            <div key={`${key} ${i}`} className={className}>{`${pssm.alphabet[i]} ${pct}%`}</div>
          )
        } else {
          lessThan1pct += pssm.alphabet[i]
        }
      }

      if (lessThan1pct !== "") {
        info.content.push(
          <div key={`${key} lessThan1pct`} className={className}>{`${lessThan1pct} < 1%`}</div>
        )
      }
    } else {
      info.content = [<div key={key} className={className}>{SPECIAL_ROWS[`${sequenceIndex}`].label}</div>]
    }

    return info
  }
}
