import type { IShape } from '@antv/g-canvas'

import { isNumber, find } from 'lodash'

import { TableColCellWithEventsAndSequence } from './base'

export class SequenceColCell extends TableColCellWithEventsAndSequence {
  groupByIndicatorShape?: IShape
  // protected drawTextShape(): void {}

  public getTextAndIconPosition(iconCount = 1) {
    const position = super.getTextAndIconPosition(iconCount)
    const iconCfg = this.getIconStyle()
    const { x: cellX } = this.getMeta()
    const { x: clipX, width: clipWidth } = this.spreadsheet.panelScrollGroup.getClip().getBBox()
    let iconX = clipX + clipWidth - iconCfg.size! * iconCount - (iconCfg.margin!.left! + iconCfg.margin!.right!) * (iconCount - 1)

    // const {x: minimapCellX} = find(this.spreadsheet.facet.layoutResult.colLeafNodes, { field: "$$minimap$$" })!
    // let iconX = minimapCellX - iconCfg.size! * iconCount - (iconCfg.margin!.left! + iconCfg.margin!.right!) * (iconCount - 1)

    if (iconX < cellX) {
      iconX = cellX
    }

    position.icon.x = iconX
    return position
  }

  protected drawGroupByIndicatorShape(): void {
    const avExtraOptions = this.spreadsheet.options.avExtraOptions
    const alignment = avExtraOptions.alignment
    const groupBy = alignment?.groupBy
    if (!isNumber(groupBy)) {
      return
    }

    const visibleSequencePositionStart = this.spreadsheet.visibleSequencePositionStart
    const visibleSequencePositionEnd = this.spreadsheet.visibleSequencePositionEnd
    if ((groupBy < visibleSequencePositionStart) || (groupBy > visibleSequencePositionEnd)) {
      this.groupByIndicatorShape?.set("visible", false)
      return
    }

    const dimensions = avExtraOptions.dimensions
    const { residueWidth } = dimensions
    const { x: cellX, y: cellY, height: cellHeight } = this.getCellArea()
    const lineWidth = 1
    if (!this.groupByIndicatorShape) {
      this.groupByIndicatorShape = this.addShape("rect", {
        attrs: {
          x: cellX + groupBy * residueWidth, 
          y: cellY + lineWidth/2, 
          width: residueWidth,
          height: cellHeight - lineWidth,
          stroke: this.theme.colCell?.text?.fill,
          lineWidth,
        }
      })
    } else {
      this.groupByIndicatorShape.attr({
        x: cellX + groupBy * residueWidth, 
      })
      this.groupByIndicatorShape.set("visible", true)
    }
  }

  // protected drawBorders(): void {
  //   return
  // }

  // protected drawVerticalBorder(dir: CellBorderPosition): void {
  //   return
  // }

  /*
  drawSpecificContent(sequencePositionStart: number, sequencePositionEnd: number): void {
    const avStore = (this.spreadsheet as AVTableSheet).avStore    
    if (avStore.get("isOverviewMode") as boolean) {
      return
    }

    const canvas = this.backgroundShape.attr('img') as OffscreenCanvas
    const ctx = canvas.getContext("2d")
    if (!!!ctx) {
      return
    }
    ctx.save()

    const visibleSequencePositionStart = (this.spreadsheet as AVTableSheet).visibleSequencePositionStart
    const dimensions = avStore.get("dimensions") as TDimensions
    const { fontFamily, residueNumberFontSize, residueWidth, residueFontWidth, paddingBottom } = dimensions

    ctx.font = `${fontFamily} ${residueNumberFontSize}px normal`
    ctx.fillStyle = this.getTextStyle().fill
    ctx.textAlign = "left"
    ctx.textBaseline = "alphabetic"
    ctx.direction = "ltr"

    const dpr = window.devicePixelRatio
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.translate(
      (sequencePositionStart - visibleSequencePositionStart) * residueWidth + (residueWidth + residueFontWidth)/2, 
      this.renderingHeight / dpr - paddingBottom
    )
    ctx.rotate(-Math.PI/2)

    let y = 0
    for (let i = sequencePositionStart + 1; i <= sequencePositionEnd + 1; ++i) {
      if ((i === 1) || (i % 10 === 0)) {
        ctx.fillText(`${i}`, 0, y)
      } else if (i % 5 === 0) {
        ctx.fillText("•", 0, y)
      }
      y += residueWidth
    }

    ctx.restore()
  }
  */

  drawContent() {
    if (this.spreadsheet.options.avExtraOptions.isOverviewMode) {
      return
    }

    const visibleSequencePositionStart = this.spreadsheet.visibleSequencePositionStart
    const visibleSequencePositionEnd = this.spreadsheet.visibleSequencePositionEnd
    // const dimensions = avStore.dimensions
    // const { residueWidth } = dimensions
    // const { x: cellX, y: cellY, height: cellHeight } = this.getCellArea()

    // if (!this.spriteShape) {
    //   const { backgroundColor, backgroundColorOpacity } = this.getBackgroundColor()
    //   this.spriteShape = this.addShape('rect', {
    //     attrs: {
    //       x: cellX + visibleSequencePositionStart * residueWidth,
    //       y: cellY,
    //       width: residueWidth * (visibleSequencePositionEnd - visibleSequencePositionStart + 1),
    //       height: cellHeight,
    //       fill: backgroundColor,
    //       fillOpacity: backgroundColorOpacity,
    //     }
    //   })
    // } else {
    //   this.spriteShape.attr({
    //     x: cellX + visibleSequencePositionStart * residueWidth,
    //     width: residueWidth * (visibleSequencePositionEnd - visibleSequencePositionStart + 1),
    //   })
    // }

    this.drawSpecificContent(visibleSequencePositionStart, visibleSequencePositionEnd)
    this.drawGroupByIndicatorShape()
  }

  drawSpecificContent(sequencePositionStart: number, sequencePositionEnd: number): void {
    const {
      fontFamily, 
      residueNumberFontSize, 
      residueNumberHeight, 
      residueWidth, 
      residueFontWidth
    } = this.spreadsheet.options.avExtraOptions.dimensions
    const { x: cellX, y: cellY, height: cellHeight } = this.getCellArea()

    let x = cellX + sequencePositionStart * residueWidth + (residueWidth + residueFontWidth)/2
    const y = cellY + (cellHeight + residueNumberHeight) / 2 - (this.spreadsheet.theme.splitLine?.horizontalBorderWidth ?? 0)
    let numMarks = 0
    for (let i = sequencePositionStart + 1; i <= sequencePositionEnd + 1; ++i) {
      let text = undefined
      if ((i === 1) || (i % 10 === 0)) {
        text = `${i}`
      } else if (i % 5 === 0) {
        text = "•"
      }

      if (text) {
        const attrs = {
          text,
          x: 0, 
          y: 0, 
          fontFamily,
          fontSize: residueNumberFontSize,
          fill: this.getTextStyle().fill,
          textAlign: "left",
          textBaseline: "alphabetic",
          direction: "ltr",
          matrix: [0, -1, 0, 1, 0, 0, x, y, 1]
        }

        if (this.textShapes[numMarks]) {
          this.textShapes[numMarks].attr(attrs)
          this.textShapes[numMarks].set("visible", true)
        } else {
          this.textShapes[numMarks] = this.addShape("text", { attrs })
        }
        ++numMarks
      }
      x += residueWidth
    }

    for (let i = numMarks; i < this.textShapes.length; ++i) {
      this.textShapes[i].set("visible", false)
    }
  }
}

