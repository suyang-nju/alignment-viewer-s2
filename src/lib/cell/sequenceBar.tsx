import type { Event as GraphEvent } from '@antv/g-canvas'
import type { TAVMouseEventInfo } from '../types'

import { isNil } from 'lodash'

import { SPECIAL_ROWS } from '../constants'
import { TableDataCellWithEventsAndSequence } from './base'

export class BarDataCell extends TableDataCellWithEventsAndSequence {
  protected getBarHeightRatios(start: number, end: number): number[] {
    const alignment = this.spreadsheet.options.avExtraOptions.alignment
    if (!alignment) {
      return []
    }

    switch (this.getMeta().fieldValue) {
      case "$$entropy$$":
        return alignment.positionalAnnotations.entropy.values.slice(start, end + 1)
      case "$$conservation$$":
        return alignment.positionalAnnotations.conservation.slice(start, end + 1)
      case "$$coverage$$":
        return alignment.positionalAnnotations.coverage.slice(start, end + 1)
      case "$$kl divergence$$": 
      return alignment.positionalAnnotations.klDivergence.values.slice(start, end + 1)
      default:
        return []
    }
  }

  /*
  protected drawBackgroundShape(): void {
    if (this.getMeta().height === 0) {
      return
    }

    const avStore = (this.spreadsheet as AVTableSheet).avStore
    const dimensions = avStore.get("dimensions")
    if (!!!dimensions) {
      return
    }
    const residueWidth = dimensions.residueWidth

    const {x: cellX, y: cellY, height: cellHeight } = this.getCellArea()
    const maxBarHeight = cellHeight * 0.8
    const y = cellY + cellHeight / 2 + maxBarHeight / 2

    const visibleSequencePositionStart = avStore.get("visibleSequencePositionStart", 0) as number
    const visibleSequencePositionEnd = avStore.get("visibleSequencePositionEnd", -1) as number
    const barHeights = this.getBarHeightRatios(visibleSequencePositionStart, visibleSequencePositionEnd).map(
      (x) => (Math.round(Math.round(x * 10) / 10 * maxBarHeight))
    )

    const path = []
    let fill, stroke
    if (false) { // bar plot
      fill = "#9da7b6"
      stroke = undefined
      const barWidth = residueWidth * 0.8
      let x = cellX + visibleSequencePositionStart * residueWidth + residueWidth * 0.1
      for (const barHeight of barHeights) {
        if (barHeight > 0) {
          path.push(['M', x, y])
          path.push(['L', x + barWidth, y])
          path.push(['L', x + barWidth, y - barHeight])
          path.push(['L', x, y - barHeight])
          path.push(['Z'])
        }
        x += residueWidth
      }  
    } else { // steps plot
      stroke = undefined
      fill = lighten("#9da7b6", 0.2)
      let x = cellX + visibleSequencePositionStart * residueWidth
      path.push(['M', x, y])
      for (const barHeight of barHeights) {
        if (barHeight > 0) {
          if (path[path.length - 1][1] !== x) {
            if (path[path.length - 1][2] !== y) {
              path.push(['L', path[path.length - 1][1], y])
            }
            path.push(['L', x, y])
          }
          path.push(['L', x, y - barHeight])
          path.push(['L', x + residueWidth, y - barHeight])
        }
        x += residueWidth
      }
      if (path[path.length - 1][1] !== x) {
        if (path[path.length - 1][2] !== y) {
          path.push(['L', path[path.length - 1][1], y])
        }
      }
      path.push(['L', x, y])
    }

    this.backgroundShape = this.addShape('path', {
      attrs: {
        path,
        fill,
        stroke,
      },
    })
  }
  */

  drawSpecificContent(sequencePositionStart: number, sequencePositionEnd: number): void {    
    const avExtraOptions = this.spreadsheet.options.avExtraOptions
    const visibleSequencePositionStart = this.spreadsheet.visibleSequencePositionStart
    const barSprites = avExtraOptions.barSprites
    const dimensions = avExtraOptions.dimensions
    const alignment = avExtraOptions.alignment
    if (!alignment) {
      return
    }

    const { residueWidth, residueFontWidth } = dimensions
    const { x: cellX, y: cellY, height: cellHeight } = this.getCellArea()
    const dpr = window.devicePixelRatio
    this.spriteShape.attr({
      sx: 0,
      sy: 0,
      sWidth: barSprites.props.width * dpr,
      sHeight: barSprites.props.height * dpr,
      dx: Math.round(cellX + sequencePositionStart * residueWidth + (residueWidth - residueFontWidth)/2),
      dy: Math.round(cellY + (cellHeight - barSprites.props.height)/2),
      dWidth: barSprites.props.width,
      dHeight: barSprites.props.height,
      skipX: residueWidth,
    })

    let barHeights: number[]
    let maxBarHeight: number
    switch (this.getMeta().fieldValue) {
      case "$$entropy$$":
        barHeights = alignment.positionalAnnotations.entropy.values
        maxBarHeight = alignment.positionalAnnotations.entropy.max || 1
        break
      case "$$conservation$$":
        barHeights = alignment.positionalAnnotations.conservation
        maxBarHeight = 1
        break
      case "$$coverage$$":
        barHeights = alignment.positionalAnnotations.coverage
        maxBarHeight = 1
        break
      case "$$kl divergence$$": 
        barHeights = alignment.positionalAnnotations.klDivergence.values
        maxBarHeight = alignment.positionalAnnotations.klDivergence.max || 1
        break
      default:
        barHeights = []
        maxBarHeight = 1
    }

    const img = this.spriteShape.attr('img') as (OffscreenCanvas | ImageData | undefined)[]
    for (let i = sequencePositionStart, j = i - visibleSequencePositionStart; i <= sequencePositionEnd; ++i, ++j) {
      img[j] = barSprites.get(barHeights[i] / maxBarHeight)
    }
  }

  getMouseEventInfo(event: GraphEvent): TAVMouseEventInfo {
    const avmei = super.getMouseEventInfo(event)
    const alignment = this.spreadsheet.options.avExtraOptions.alignment
    if (alignment) {
      const sequencePosition = avmei.sequencePosition
      const sequenceIndex = avmei.sequenceIndex as keyof typeof SPECIAL_ROWS
      const key = sequenceIndex
      const className = sequenceIndex
      let value, digits
      switch (sequenceIndex) {
        case "$$coverage$$":
          value = alignment.positionalAnnotations.coverage[sequencePosition] * 100
          digits = 0
          break
        case "$$conservation$$":
          value = alignment.positionalAnnotations.conservation[sequencePosition]
          digits = 2
          break
        case "$$entropy$$":
          value = alignment.positionalAnnotations.entropy.values[sequencePosition]
          digits = 2
          break
        case "$$kl divergence$$":
          value = alignment.positionalAnnotations.klDivergence.values[sequencePosition]
          digits = 2
          break
      }
  
      let text = SPECIAL_ROWS[sequenceIndex].label
      if (!isNil(value)) {
        text += ": " + value.toFixed(digits)
      }
      if (sequenceIndex === "$$coverage$$") {
        text += "%"
      }
  
      avmei.extraInfo = [<div key={key} className={className}>{text}</div>]
    }

    return avmei
  }
}

