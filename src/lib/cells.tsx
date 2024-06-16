import type {
  FormatResult, 
  IconCondition, 
  S2CellType, 
  ViewMeta, 
  Node as S2Node, 
  BaseCell, 
  TextTheme,
} from '@antv/s2'
import type { IShape, Point, Event as GraphEvent } from '@antv/g-canvas'
import type { ReactNode } from 'react'
import type { TAlignment, TAlignmentPositionsToStyle } from './Alignment'
import type { TDimensions, TContextualInfo } from '../components/AlignmentViewer'
import type Sprites from './sprites'
import type { SequenceLogos, SequenceLogosGroups } from './sequenceLogos'
import type BarSprites from './BarSprites'

import { isEmpty, isNil, isNumber } from 'lodash'
import { lighten } from 'color2k'
import {
  TableSeriesCell, 
  TableDataCell, 
  TableColCell, 
  getBorderPositionAndStyle, 
  CellBorderPosition, 
  renderIcon, 
  renderLine,
  InteractionStateName
} from '@antv/s2'
import { Shape } from '@antv/g-canvas'

import { AVTableSheet, SPECIAL_ROWS } from './AVTableSheet'
import { AA1to3, ALPHABET, formatSequence } from './Alignment'
import { ShapeBaseSupportingOffscreenCanvas } from './OffscreenCanvas'

type TConstructor = new (...args: any[]) => {}
function withEvents<TBase extends TConstructor>(Base: TBase) {
  return class BaseWithEvents extends Base {
    public drawConditionIconShapes(): void {
      const avStore = (this.spreadsheet as AVTableSheet).avStore
      if (avStore.get("isOverviewMode") as boolean) {
        return
      }
  
      // if (this.getMeta().rowIndex % 2) {
      //   return
      // }
  
      // super.drawConditionIconShapes()
  
      const iconCondition: IconCondition = this.findFieldCondition(this.conditions?.icon)
      if (iconCondition && iconCondition.mapping) {
        const { icon: iconName, ...attrs } = this.mappingValue(iconCondition) ?? {}
        if (!isEmpty(iconName)) {
          const position = this.getIconPosition()
          const { size } = this.theme.dataCell.icon
          this.conditionIconShape = renderIcon(this, {
            ...attrs,
            ...position,
            // fill: this.getTextStyle().fill,
            // stroke: this.getTextStyle().fill,
            name: iconName,
            width: size,
            height: size,
          });
          this.addConditionIconShape(this.conditionIconShape)
        }
      }
    }
  
    // protected drawBorderShape(): void {
    //   // console.log("drawBorderShape")
    // }

    getContextualInfo(event: GraphEvent, target: S2CellType, viewMeta: ViewMeta, iconName?: string): TContextualInfo {
      const spreadsheet = viewMeta.spreadsheet as AVTableSheet
      const avStore = spreadsheet.avStore
      const firstSequenceRowIndex = avStore.get("firstSequenceRowIndex") as number
      const alignment = avStore.get("alignment") as TAlignment
      const sortedDisplayedIndices = avStore.get("sortedDisplayedIndices") as number[]
      const dimensions = avStore.get("dimensions") as TDimensions
      const { scrollX = 0, scrollY = 0 } = spreadsheet.facet.getScrollOffset()

      let sequenceIndex: number | string
      let row: number | undefined
      if ((viewMeta.valueField === "__sequenceIndex__") && (viewMeta.fieldValue === "$$overview$$")) {
        row = Math.floor((event.y - viewMeta.spreadsheet.facet.columnHeader.getBBox().height + scrollY - viewMeta.y) / dimensions.residueHeight)
        sequenceIndex = sortedDisplayedIndices[row]
        ++row // adjust to 1-based
      } else {
        row = viewMeta.rowIndex - firstSequenceRowIndex + 1 // 1-based
        if (row <= 0) {
          row = undefined
        }

        sequenceIndex = spreadsheet.dataSet.getCellData({
          query: {
            rowIndex: viewMeta.rowIndex
          }
        }).__sequenceIndex__
      }

      let restOfGroup: number | undefined = undefined
      if (alignment.groupBy && isNumber(sequenceIndex)) {
        const groupIndex = alignment.sequences[sequenceIndex].__groupIndex__
        const collapsedGroups = avStore.get("collapsedGroups") as number[]
        if (collapsedGroups.includes(groupIndex)) {
          restOfGroup = alignment.sequences[sequenceIndex].__groupSize__ - 1
        }
      }

      let sequenceId
      if (sequenceIndex === "$$reference$$") {
        sequenceId = alignment.referenceSequence?.id
      } else if (sequenceIndex === "$$consensus$$") {
        sequenceId = alignment.consensusSequence?.id
      } else if (isNumber(sequenceIndex)) {
        sequenceId = alignment.sequences[sequenceIndex].id
        if (restOfGroup) {
          sequenceId = `Group: ${sequenceId} + ${restOfGroup} sequences`
        }
      }
  
      const panelScrollGroupClipBBox = spreadsheet.panelScrollGroup.getClip().getBBox()
      const frozenColGroupWidth = spreadsheet.frozenColGroup.getBBox().width
      // const scrollX = panelScrollGroupClipBBox.x - frozenColGroupWidth
      let residueIndex: number | undefined, col: number | undefined
      let anchorX, anchorWidth
      if (viewMeta.valueField === "__sequenceIndex__") {
        residueIndex = Math.floor((event.x + scrollX - viewMeta.x) / dimensions.residueWidth)
        col = residueIndex + 1  
        anchorX = viewMeta.x + residueIndex * dimensions.residueWidth
        anchorWidth = dimensions.residueWidth  
      } else {
        residueIndex = undefined
        col = undefined
        anchorX = viewMeta.x
        anchorWidth = viewMeta.width
      }
  
      if (viewMeta.x >= frozenColGroupWidth) {
        anchorX -= scrollX
        if (anchorX < frozenColGroupWidth) {
          const hiddenWidth = frozenColGroupWidth - anchorX
          anchorX += hiddenWidth
          anchorWidth -= hiddenWidth
        }
      }
      anchorX += event.clientX - event.x
      
      const frozenRowGroupHeight = spreadsheet.frozenRowGroup.getBBox().height
      let anchorY = viewMeta.y
      let anchorHeight = viewMeta.height
      if (viewMeta.y >= frozenRowGroupHeight) {
        anchorY = viewMeta.y - panelScrollGroupClipBBox.y + frozenRowGroupHeight
        if (anchorY < frozenRowGroupHeight) {
          const hiddenHeight = frozenRowGroupHeight - anchorY
          anchorY += hiddenHeight
          anchorHeight -= hiddenHeight
        }
      }
      anchorY += event.clientY - event.y + dimensions.colHeight
  
      let content: ReactNode[] = []
      if (!isNil(viewMeta.fieldValue)) {
        const fieldName = alignment.annotationFields[viewMeta.valueField]?.name
        let fieldContent = `${viewMeta.fieldValue}`
        if (restOfGroup) {
          fieldContent += ` + ${restOfGroup} others`
        }
        content.push(<div key="other" className="other">{fieldName}: {fieldContent}</div>)
      }
  
      return {
        key: `${viewMeta.id} ${sequenceIndex} ${residueIndex}`,
        sequenceIndex,
        residueIndex,
        row,
        col,
        sequenceId,
        content,
        anchorX,
        anchorY,
        anchorWidth,
        anchorHeight,
      }
    }
  
    onClick(event: GraphEvent, target: S2CellType, viewMeta: ViewMeta, iconName?: string) {
      // implemented in subclasses
    }
  }
}

const TableColCellWithEvents = withEvents(TableColCell)
const TableSeriesCellWithEvents = withEvents(TableSeriesCell)
const TableDataCellWithEvents = withEvents(TableDataCell)

function withSequence<TBase extends BaseCell & TConstructor>(Base: TBase) {
  return class BaseWithEvents extends Base {
    renderedSequencePositionStart: number | undefined = undefined
    renderedSequencePositionEnd: number | undefined = undefined
    renderingHeight = 0

    getShapeBase(): typeof Shape {
      return ShapeBaseSupportingOffscreenCanvas
    }
  
    protected drawTextShape(): void {}

    protected drawBackgroundShape(): void {}

    /*
    drawContent(): void {
      const viewMeta = this.getMeta()
      if (viewMeta.height === 0) {
        if (this.contain(this.backgroundShape)) {
          this.removeChild(this.backgroundShape, true)
          this.backgroundShape = undefined
          console.log('remove child height === 0')
        }
        return
      }
  
      if (!this.contain(this.backgroundShape)) {
        this.backgroundShape = undefined
      }
      
      const spreadsheet = this.spreadsheet as AVTableSheet
      const avStore = spreadsheet.avStore
      const visibleSequencePositionStart = avStore.get("visibleSequencePositionStart") as number
      const visibleSequencePositionEnd = avStore.get("visibleSequencePositionEnd") as number
      const visibleSequenceIndexStart = avStore.get("visibleSequenceIndexStart") as number
      const visibleSequenceIndexEnd = avStore.get("visibleSequenceIndexEnd") as number

      if (visibleSequencePositionStart < 0) {
        // console.log("visible", visibleSequencePositionStart, visibleSequencePositionEnd, visibleSequenceIndexStart, visibleSequenceIndexEnd)
        return
      }
  
      const sequenceIndex = viewMeta.fieldValue
      if (
        (this.renderedSequencePositionStart === visibleSequencePositionStart) && 
        (this.renderedSequencePositionEnd === visibleSequencePositionEnd) &&
        (sequenceIndex !== "$$overview$$")
      ) {
        return
      }

      const dimensions = avStore.get("dimensions") as TDimensions
      const { residueWidth, residueHeight } = dimensions
      const { x: cellX, y: cellY, height: cellHeight } = this.getCellArea()
      const { width: spreadsheetWidth, height: spreadsheetHeight } = spreadsheet.getCanvasElement()

      const dpr = window.devicePixelRatio
      const renderingWidth = dpr * residueWidth * (visibleSequencePositionEnd - visibleSequencePositionStart + 1)
      this.renderingHeight = (
        sequenceIndex === "$$overview$$"
        ? dpr * residueHeight * (visibleSequenceIndexEnd - visibleSequenceIndexStart + 1)
        : dpr * cellHeight
      )

      const attrs = {
        x: cellX + visibleSequencePositionStart * residueWidth,
        y: (sequenceIndex === "$$overview$$") ? (cellY + visibleSequenceIndexStart * residueHeight) : cellY,
        width: renderingWidth / dpr,
        height: this.renderingHeight / dpr,
        sx: 0,
        sy: 0,
        sWidth: renderingWidth,
        sHeight: this.renderingHeight,
        dx: cellX + visibleSequencePositionStart * residueWidth,
        dy: (sequenceIndex === "$$overview$$") ? (cellY + visibleSequenceIndexStart * residueHeight) : cellY,
        dWidth: renderingWidth / dpr,
        dHeight: this.renderingHeight / dpr,
      }

      let sourceCanvas: OffscreenCanvas | undefined = this.backgroundShape?.attr('img')
      if (this.backgroundShape) {
        if ((sourceCanvas.width < renderingWidth) || (sourceCanvas.height < this.renderingHeight)) {
          if (sourceCanvas.height < this.renderingHeight) {
            // height changed, better not to reuse existing content
            // from previous render because it is probably obsolete
            sourceCanvas = undefined
          }
          this.removeChild(this.backgroundShape, true)
          this.backgroundShape = undefined
          // console.log('remove child', tmpCanvas.width, tmpCanvas.height, canvasWidth, canvasHeight)
        }
      }

      if (isNil(this.backgroundShape)) {
        // console.log('new offscreencanvas', spreadsheetWidth * dpr, spreadsheetHeight * dpr, canvasHeight)
        const canvasWidth = spreadsheetWidth // Math.max(renderingWidth, spreadsheetWidth)
        const canvasHeight = this.renderingHeight
        this.backgroundShape = this.addShape('offscreenCanvas', {
          // zIndex: 1,
          attrs: {
            img: new OffscreenCanvas(canvasWidth, canvasHeight),
          },
        })
      }

      if (isNil(this.backgroundShape)) {
        return
      }
  
      this.backgroundShape.attr(attrs)

      const destinationCanvas = this.backgroundShape.attr('img') as OffscreenCanvas
      const ctx = destinationCanvas.getContext("2d")
      if ((!!!ctx) || isNil(sourceCanvas) || (sequenceIndex === "$$overview$$")) {
        // nothing to render or to reuse from previous render
        this.renderedSequencePositionStart = undefined
        this.renderedSequencePositionEnd = undefined

        if (!!!ctx) {
          return
        }
      }

      ctx.resetTransform()
      ctx.fillStyle = this.getBackgroundColor().backgroundColor
      ctx.imageSmoothingEnabled = false
      // ctx.fillRect(0, 0, canvasWidth, canvasHeight)

      // try to reuse rendered content from previous render: copy the overlapping area in one fell swoop
      if (!isNil(this.renderedSequencePositionStart) && !isNil(this.renderedSequencePositionEnd)) {
        // sequence position start/end are residue numbers in the sequence
        // offset start/end are 0-indexed destination canvas coordinates in units of (residueWidth * dpr)
        const visibleOffsetStart = 0 // visibleSequencePositionStart - visibleSequencePositionStart
        const visibleOffsetEnd = visibleSequencePositionEnd - visibleSequencePositionStart

        let destinationOffsetStart = this.renderedSequencePositionStart - visibleSequencePositionStart
        let destinationOffsetEnd = this.renderedSequencePositionEnd - visibleSequencePositionStart
        if ((destinationOffsetStart <= visibleOffsetEnd) && (destinationOffsetEnd >= visibleOffsetStart)) {
          // there is overlap with previous render to reuse
          // clamp to [visibleOffsetStart, visibleOffsetEnd] to get the overlapping area
          if (destinationOffsetStart < visibleOffsetStart) {
            destinationOffsetStart = visibleOffsetStart
          } else if (destinationOffsetStart > visibleOffsetEnd) {
            destinationOffsetStart = visibleOffsetEnd
          }

          if (destinationOffsetEnd < visibleOffsetStart) {
            destinationOffsetEnd = visibleOffsetStart
          } else if (destinationOffsetEnd > visibleOffsetEnd) {
            destinationOffsetEnd = visibleOffsetEnd
          }

          const destinationOffsetWidth = destinationOffsetEnd - destinationOffsetStart + 1

          const sourceOffsetStart = destinationOffsetStart + visibleSequencePositionStart - this.renderedSequencePositionStart
          const sourceOffsetEnd = destinationOffsetEnd + visibleSequencePositionStart - this.renderedSequencePositionStart
          const sourceOffsetWidth = sourceOffsetEnd - sourceOffsetStart + 1

          this.renderedSequencePositionStart = destinationOffsetStart + visibleSequencePositionStart
          this.renderedSequencePositionEnd = destinationOffsetEnd + visibleSequencePositionStart

          ctx.drawImage(
            sourceCanvas as OffscreenCanvas,
            dpr * sourceOffsetStart * residueWidth, 
            0,
            dpr * sourceOffsetWidth * residueWidth,
            this.renderingHeight,
            dpr * destinationOffsetStart * residueWidth,
            0,
            dpr * destinationOffsetWidth * residueWidth,
            this.renderingHeight
          )
        } else {
          // no overlap with previous render, nothing to reuse
          this.renderedSequencePositionStart = undefined
          this.renderedSequencePositionEnd = undefined
        }
      }

      // draw remaining content (not reused from previous render)
      let remainingRegions: number[][]
      if (!isNil(this.renderedSequencePositionStart) && !isNil(this.renderedSequencePositionEnd)) {
        remainingRegions = [
          [visibleSequencePositionStart, this.renderedSequencePositionStart - 1], 
          [this.renderedSequencePositionEnd + 1, visibleSequencePositionEnd], 
        ]
      } else {
        remainingRegions = [
          [visibleSequencePositionStart, visibleSequencePositionEnd]
        ]
      }
  
      for (const [sequencePositionStart, sequencePositionEnd] of remainingRegions) {
        if (sequencePositionStart > sequencePositionEnd) {
          continue
        }
  
        const offsetStart = sequencePositionStart - visibleSequencePositionStart
        const offsetEnd = sequencePositionEnd - visibleSequencePositionStart
        const offsetWidth = offsetEnd - offsetStart + 1
        ctx.fillRect(
          offsetStart * dpr * residueWidth, 
          0, 
          offsetWidth * dpr * residueWidth, 
          this.renderingHeight
        )
  
        this.drawSpecificContent(sequencePositionStart, sequencePositionEnd)
      }

      this.renderedSequencePositionStart = visibleSequencePositionStart
      this.renderedSequencePositionEnd = visibleSequencePositionEnd
    }
    */

    drawContent(): void {
      if (this.getMeta().height === 0) {
        if (this.contain(this.backgroundShape)) {
          this.removeChild(this.backgroundShape, true)
          this.backgroundShape = undefined
          console.log('remove child height === 0')
        }
        return
      }
  
      if (!this.contain(this.backgroundShape)) {
        this.backgroundShape = undefined
      }
      
      if (isNil(this.backgroundShape)) {
        this.backgroundShape = this.addShape('offscreenCanvas', {
          // zIndex: 1,
          attrs: {
            img: [],
            imageSmoothingEnabled: false,
          }
        })
      }
  
      const { x: cellX, y: cellY, width: cellWidth, height: cellHeight } = this.getCellArea()
      this.backgroundShape.attr({
        x: cellX,
        y: cellY,
        width: cellWidth,
        height: cellHeight,
      })

      const spreadsheet = this.spreadsheet as AVTableSheet
      const avStore = spreadsheet.avStore
      const visibleSequencePositionStart = avStore.get("visibleSequencePositionStart") as number
      const visibleSequencePositionEnd = avStore.get("visibleSequencePositionEnd") as number
  
      this.drawSpecificContent(visibleSequencePositionStart, visibleSequencePositionEnd)
      const img = this.backgroundShape.attr('img') as (OffscreenCanvas | ImageData | undefined)[]
      if (this.getMeta().fieldValue === "$$overview$$") {
        for (let i = 1; i < img.length; ++i) {
          img[i] = undefined
        }
      } else {
        for (let i = visibleSequencePositionEnd - visibleSequencePositionStart + 1; i < img.length; ++i) {
          img[i] = undefined
        }  
      }
      this.renderedSequencePositionStart = visibleSequencePositionStart
      this.renderedSequencePositionEnd = visibleSequencePositionEnd
    }
    
    drawSpecificContent(sequencePositionStart: number, sequencePositionEnd: number): void {
      // implemented in subclasses
    }

    updateByState(stateName: InteractionStateName): void {
      if ((stateName !== InteractionStateName.HOVER) && (stateName !== InteractionStateName.HOVER_FOCUS)) {
        super.updateByState(stateName)
      }
    }
  }
}

const TableDataCellWithEventsAndSequence = withSequence(TableDataCellWithEvents)
const TableColCellWithEventsAndSequence = withSequence(TableColCellWithEvents)

export class TextColCell extends TableColCellWithEvents {
  protected drawTextShape(): void {
    const avStore = (this.spreadsheet as AVTableSheet).avStore
    if (avStore.size() === 0) {
      return
    }

    if (avStore.get("isOverviewMode") as boolean) {
      return
    }

    super.drawTextShape()
  }

  protected drawBorders() {
    const avStore = (this.spreadsheet as AVTableSheet).avStore
    const alignment = avStore.get("alignment") as TAlignment
    const viewMeta = this.getMeta()
    if (alignment?.groupBy === viewMeta.field) {
      for (const dir of Object.values(CellBorderPosition)) {
        const { position, style } = getBorderPositionAndStyle(
          dir,
          viewMeta,
          this.theme.colCell.cell,
        )
        style.stroke = this.theme.colCell?.text?.fill
        renderLine(this, position, style)
  
      }  
    } else {
      super.drawBorders()
    }
  }
}


export class SequenceSeriesColCell extends TableColCellWithEvents {
  protected drawTextShape(): void {
    const avStore = (this.spreadsheet as AVTableSheet).avStore
    if (avStore.get("isOverviewMode") as boolean) {
      return
    }

    super.drawTextShape()
    this.drawGroupIconShapes()
  }

  public drawGroupIconShapes(): void {
    const spreadsheet = this.spreadsheet as AVTableSheet
    const avStore = spreadsheet.avStore
    const alignment = avStore.get("alignment") as TAlignment

    if (alignment?.groupBy === undefined) {
      return
    }

    const collapsedGroups = avStore.get("collapsedGroups") as number[]
    let iconName = "AntdPlus"
    for (let groupIndex = 0; groupIndex < alignment.groups.length; ++groupIndex) {
      if ((alignment.groups[groupIndex].members.length > 1) && !collapsedGroups.includes(groupIndex)) {
        iconName = "AntdMinus"
        break
      }
    }

    const iconPosition = this.getIconPosition()
    const {size: iconSize = 10} = this.getIconStyle() ?? {}
    // const { size: iconSize = 10 } = spreadsheet.theme.rowCell?.icon ?? {}
    const fill = this.getTextStyle().fill
    this.conditionIconShape = renderIcon(this, {
      name: iconName,
      ...iconPosition,
      width: iconSize,
      height: iconSize,
      fill,
      stroke: fill,
    });
    this.addConditionIconShape(this.conditionIconShape)
  }
}


export class SequenceColCell extends TableColCell {
  // protected drawInteractiveBgShape(): void {}

  protected drawTextShape(): void {}

  // protected drawBorders(): void {
  //   return
  // }

  protected drawVerticalBorder(dir: CellBorderPosition): void {
    return
  }

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

    const visibleSequencePositionStart = avStore.get("visibleSequencePositionStart") as number
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
    const avStore = (this.spreadsheet as AVTableSheet).avStore    
    if (avStore.get("isOverviewMode") as boolean) {
      return
    }

    const visibleSequencePositionStart = avStore.get("visibleSequencePositionStart") as number
    const visibleSequencePositionEnd = avStore.get("visibleSequencePositionEnd") as number
    this.drawSpecificContent(visibleSequencePositionStart, visibleSequencePositionEnd)
  }

  drawSpecificContent(sequencePositionStart: number, sequencePositionEnd: number): void {
    const avStore = (this.spreadsheet as AVTableSheet).avStore    
    const dimensions = avStore.get("dimensions") as TDimensions
    const { fontFamily, residueNumberFontSize, residueNumberHeight, residueWidth, residueFontWidth, paddingBottom } = dimensions
    const { x: cellX, y: cellY, height: cellHeight } = this.getCellArea()

    let x = cellX + sequencePositionStart * residueWidth + (residueWidth + residueFontWidth)/2
    const y = cellY + (cellHeight + residueNumberHeight) / 2  // cellY + cellHeight - paddingBottom
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


export class MinimapColCell extends TableColCell {
  protected drawTextShape(): void {
  }

  // protected drawBackgroundShape(): void {
  // }
}


export class SequenceSeriesCell extends TableSeriesCellWithEvents {
  protected getFormattedFieldValue(): FormatResult {
    const avStore = (this.spreadsheet as AVTableSheet).avStore
    const rowIndex = this.getMeta().rowIndex
    const firstSequenceRowIndex = avStore.get("firstSequenceRowIndex") as number

    const row = rowIndex - firstSequenceRowIndex + 1 // 1-based
    return {
      formattedValue: (row > 0) ? `${row}` : "",
      value: rowIndex
    }
  }

  protected drawTextShape(): void {
    const avStore = (this.spreadsheet as AVTableSheet).avStore
    if (avStore.get("isOverviewMode") as boolean) {
      return
    }

    super.drawTextShape()
    this.drawGroupIconShapes()
  }

  public drawGroupIconShapes(): void {
    const spreadsheet = this.spreadsheet as AVTableSheet
    const avStore = spreadsheet.avStore
    const alignment = avStore.get("alignment") as TAlignment

    if (alignment?.groupBy === undefined) {
      return
    }

    const viewMeta = this.getMeta()
    const firstSequenceRowIndex = avStore.get("firstSequenceRowIndex") as number
    const sortedDisplayedIndices = avStore.get("sortedDisplayedIndices") as number[]
    const i = viewMeta.rowIndex - firstSequenceRowIndex
    if (i < 0) {
      return
    }
    
    const sequenceIndex = sortedDisplayedIndices[i]
    if (alignment.sequences[sequenceIndex].__groupSize__ === 1) {
      return
    }

    const prevRowSequenceIndex = (i === 0) ? undefined : sortedDisplayedIndices[i - 1]
    const nextRowSequenceIndex = (i === sortedDisplayedIndices.length - 1) ? undefined : sortedDisplayedIndices[i + 1]

    const groupIndex = alignment.sequences[sequenceIndex].__groupIndex__
    const prevRowGroupIndex = (prevRowSequenceIndex === undefined) ? undefined : alignment.sequences[prevRowSequenceIndex].__groupIndex__
    const nextRowGroupIndex = (nextRowSequenceIndex === undefined) ? undefined : alignment.sequences[nextRowSequenceIndex].__groupIndex__

    const collapsedGroups = avStore.get("collapsedGroups") as number[]
    let iconName: string
    if (groupIndex !== prevRowGroupIndex) {
      iconName = collapsedGroups.includes(groupIndex) ? "AntdPlus" : "AntdMinus"
    } else if (groupIndex !== nextRowGroupIndex) {
      iconName = "L"
    } else {
      iconName = "|"
    }                

    const iconPosition = this.getIconPosition()
    const {size: iconSize = 10} = this.getIconStyle() ?? {}
    // const { size: iconSize = 10 } = spreadsheet.theme.rowCell?.icon ?? {}
    const fill = this.getTextStyle().fill
    const { y: cellY, height: cellHeight } = this.getCellArea()
    if (iconName === "L") {
      this.textShapes.push(this.addShape("polyline", {
        attrs: {
          points: [
            [iconPosition.x + iconSize / 2, cellY],
            [iconPosition.x + iconSize / 2, iconPosition.y + iconSize],
            [iconPosition.x + iconSize, iconPosition.y + iconSize]
          ],
          lineWidth: 1,
          stroke: fill,
        }
      }))
    } else if (iconName === "|") {
      this.textShapes.push(this.addShape("line", {
        attrs: {
          x1: iconPosition.x + iconSize / 2,
          y1: cellY,
          x2: iconPosition.x + iconSize / 2,
          y2: cellY + cellHeight,
          lineWidth: 1,
          stroke: fill,
        }
      }))
    } else {
      this.conditionIconShape = renderIcon(this, {
        name: iconName,
        ...iconPosition,
        width: iconSize,
        height: iconSize,
        fill,
        stroke: fill,
      });
      this.addConditionIconShape(this.conditionIconShape)

      if (!collapsedGroups.includes(groupIndex)) {
        this.textShapes.push(this.addShape("line", {
          attrs: {
            x1: iconPosition.x + iconSize / 2,
            y1: iconPosition.y + iconSize,
            x2: iconPosition.x + iconSize / 2,
            y2: cellY + cellHeight,
            lineWidth: 1,
            stroke: fill,
          }
        }))  
      }
    }    
  }
}


export class TextDataCell extends TableDataCellWithEvents {
  protected getFormattedFieldValue(): FormatResult {
    let { formattedValue = "", value } = super.getFormattedFieldValue()
    const viewMeta = this.getMeta()
    const spreadsheet = viewMeta.spreadsheet as AVTableSheet
    const avStore = spreadsheet.avStore
    const alignment = avStore.get("alignment") as TAlignment
    const collapsedGroups = avStore.get("collapsedGroups") as number[]

    if (!alignment) {
      return { formattedValue, value }
    }
    
    const sequenceIndex = spreadsheet.dataSet.getCellData({
      query: {
        rowIndex: viewMeta.rowIndex
      }
    }).__sequenceIndex__

    if (alignment.groupBy && isNumber(sequenceIndex)) {
      const groupIndex = alignment.sequences[sequenceIndex].__groupIndex__
      if (collapsedGroups.includes(groupIndex)) {
        const groupSize = alignment.sequences[sequenceIndex].__groupSize__
        if (viewMeta.valueField !== alignment.groupBy) {
          formattedValue += `\n(+${groupSize - 1})`
        } else {
          formattedValue += `\n(×${groupSize})`
        }
      }
    }

    return { formattedValue, value }
  }

  protected getTextStyle(): TextTheme {
    const theme = super.getTextStyle()

    const viewMeta = this.getMeta()
    const spreadsheet = viewMeta.spreadsheet as AVTableSheet
    const avStore = spreadsheet.avStore
    const alignment = avStore.get("alignment") as TAlignment
    
    if (alignment) {
      const { number, string } = alignment.annotationFields[viewMeta.valueField]
      theme.textAlign = (number > string) ? "right" : "left"  
    }

    return theme
  }

  protected drawTextShape(): void {
    const avStore = (this.spreadsheet as AVTableSheet).avStore
    if (avStore.size() === 0) {
      return
    }

    if (avStore.get("isOverviewMode") as number) {
      return
    }

    super.drawTextShape()
  }

}


export class DummyMinimapDataCell extends TableDataCellWithEvents {
  protected drawTextShape(): void {}

  // protected drawBackgroundShape(): void {
  // }

  getBackgroundColor() {
    return {
      backgroundColor: this.spreadsheet.theme.background?.color ?? "transparent",
      backgroundColorOpacity: this.spreadsheet.theme.background?.opacity ?? 0,
      intelligentReverseTextColor: false
    }
  }
}


export class SequenceIdDataCell extends TextDataCell {
  protected getFormattedFieldValue(): FormatResult {
    let { formattedValue, value } = super.getFormattedFieldValue()
    const viewMeta = this.getMeta()
    const spreadsheet = viewMeta.spreadsheet as AVTableSheet
    const avStore = spreadsheet.avStore
    const alignment = avStore.get("alignment") as TAlignment

    if (!!!alignment) {
      return { formattedValue, value }
    }
    
    const sequenceIndex = spreadsheet.dataSet.getCellData({
      query: {
        rowIndex: viewMeta.rowIndex
      }
    }).__sequenceIndex__

    if (sequenceIndex === "$$reference$$") {
      formattedValue += `\n${alignment?.referenceSequence.id}`
    }

    return { formattedValue, value }
  }

  protected getTextStyle() {
    const textStyle = super.getTextStyle()

    const viewMeta = this.getMeta()
    const spreadsheet = viewMeta.spreadsheet as AVTableSheet
    const avStore = spreadsheet.avStore
    const alignment = avStore.get("alignment") as TAlignment
    
    const sequenceIndex = spreadsheet.dataSet.getCellData({
      query: {
        rowIndex: viewMeta.rowIndex
      }
    }).__sequenceIndex__

    if (typeof sequenceIndex === "number") {
      textStyle.textAlign = "left"
      if (sequenceIndex === alignment?.referenceSequenceIndex) {
        textStyle.fontWeight = "bold"
      }
    } else {
      textStyle.textAlign = "right"
      textStyle.fontWeight = "bold"
    }

    return textStyle
  }

  // add underline to links
  // protected drawTextShape(): void {
  //   const avStore = (this.spreadsheet as AVTableSheet).avStore
  //   if (avStore.size() === 0) {
  //     return
  //   }

  //   if (avStore.get("isOverviewMode") as boolean) {
  //     return
  //   }

  //   super.drawTextShape()
  //   const { x, y, width, height } = this.textShape.getBBox()
  //   const underlineShape = this.textShapes.push(this.addShape("line", {
  //     attrs: {
  //       x1: x,
  //       y1: y + height,
  //       x2: x + width,
  //       y2: y + height,
  //       stroke: this.spreadsheet.theme.dataCell?.text?.linkTextFill,
  //       cursor: "pointer",
  //     }
  //   }))
  //   this.textShapes[1].set("visible", false)
  // }

  updateByState(stateName: InteractionStateName): void {
    if (stateName === InteractionStateName.HOVER_FOCUS){
      let { __sequenceIndex__, __links__ } = this.spreadsheet.dataSet.getCellData({
        query: {
          rowIndex: this.getMeta().rowIndex
        }
      })

      if (__sequenceIndex__ === "$$reference$$") {
        const avStore = (this.spreadsheet  as AVTableSheet).avStore
        const alignment = avStore.get("alignment") as TAlignment
        __sequenceIndex__ = alignment.referenceSequenceIndex
        __links__ = alignment.referenceSequence.__links__
      }

      if (__links__?.length > 0) {
        this.textShape?.attr({
          fill: this.spreadsheet.theme.dataCell?.text?.linkTextFill,
          cursor: 'pointer',
        })
        // this.textShapes[1]?.set("visible", true)
        this.stateShapes.forEach((shape: IShape) => {
          shape.attr("cursor", "pointer")
        })
      }
    }
    super.updateByState(stateName)
  }

  hideInteractionShape(): void {
    this.textShape?.attr({
      fill: this.spreadsheet.theme.dataCell?.text?.fill,
      cursor: 'default',
    })
    // this.textShapes[1]?.set("visible", false)
    super.hideInteractionShape()
  }

  getContextualInfo(event: GraphEvent, target: S2CellType, viewMeta: ViewMeta, iconName?: string): TContextualInfo {
    let info: TContextualInfo | undefined = super.getContextualInfo(event, target, viewMeta, iconName)
    // console.log(event, target, viewMeta)
    info.content = []
    const { __links__ } = viewMeta.spreadsheet.dataSet.getCellData({
      query: {
        rowIndex: viewMeta.rowIndex
      }
    })
    
    if (__links__?.length > 0) {
      info.content = [(
        <div key="links" className="links">
          Link(s): {__links__.map(({name, url}: {name: string, url: string}) => (
            <span key={url} className="link">
              {name}
            </span>
          ))}
        </div>
      )]
    }

    return info
  }

  onClick(event: GraphEvent, target: S2CellType, viewMeta: ViewMeta, iconName?: string) {
    if (true || !!iconName) {
      let { __sequenceIndex__, __links__ } = this.spreadsheet.dataSet.getCellData({
        query: {
          rowIndex: this.getMeta().rowIndex
        }
      })

      if (__sequenceIndex__ === "$$reference$$") {
        const avStore = (this.spreadsheet  as AVTableSheet).avStore
        const alignment = avStore.get("alignment") as TAlignment
        __sequenceIndex__ = alignment.referenceSequenceIndex
        __links__ = alignment.referenceSequence.__links__
      }
      
      if (__links__?.length > 0) {
        for (const { name, url } of __links__) {
          window.open(url, "_blank")
          break
        }
      }  
    }
  }
}


export class SequenceDataCell extends TableDataCellWithEventsAndSequence {
  drawSpecificContent(sequencePositionStart: number, sequencePositionEnd: number): void {
    const spreadsheet = this.spreadsheet as AVTableSheet
    const avStore = spreadsheet.avStore
    const dimensions = avStore.get("dimensions") as TDimensions
    const { residueWidth, residueHeight } = dimensions
    const { x: cellX, y: cellY, height: cellHeight } = this.getCellArea()
    const sequenceIndex = this.getMeta().fieldValue
    const img = this.backgroundShape.attr('img') as (OffscreenCanvas | ImageData | undefined)[]
    
    if (sequenceIndex === "$$overview$$") {
      const visibleSequenceIndexStart = avStore.get("visibleSequenceIndexStart") as number
      const visibleSequenceIndexEnd = avStore.get("visibleSequenceIndexEnd") as number
      // this.backgroundShape.attr({
      //   sx: sequencePositionStart,
      //   sy: visibleSequenceIndexStart,
      //   sWidth: sequencePositionEnd - sequencePositionStart + 1,
      //   sHeight: visibleSequenceIndexEnd - visibleSequenceIndexStart + 1,
      //   dx: Math.round(cellX + sequencePositionStart * residueWidth),
      //   dy: Math.round(cellY + visibleSequenceIndexStart * residueHeight),
      //   dWidth: residueWidth * (sequencePositionEnd - sequencePositionStart + 1),
      //   dHeight: residueHeight * (visibleSequenceIndexEnd - visibleSequenceIndexStart + 1),
      // })
      // img[0] = avStore.get("minimapImage") as OffscreenCanvas

      const sWidth = sequencePositionEnd - sequencePositionStart + 1
      const sHeight = visibleSequenceIndexEnd - visibleSequenceIndexStart + 1
      if (!(
        (img[0] instanceof OffscreenCanvas) &&
        (img[0].width >= sWidth) &&
        (img[0].height >= sHeight)
      )) {
        img[0] = new OffscreenCanvas(sWidth, sHeight)
      }

      const overviewImageData = avStore.get("overviewImageData") as ImageData
      const ctx = img[0].getContext("2d")
      ctx?.putImageData(overviewImageData, -sequencePositionStart, -visibleSequenceIndexStart, sequencePositionStart, visibleSequenceIndexStart, sWidth, sHeight)
      this.backgroundShape.attr({
        sx: 0,
        sy: 0,
        sWidth,
        sHeight,
        dx: Math.round(cellX + sequencePositionStart * residueWidth),
        dy: Math.round(cellY + visibleSequenceIndexStart * residueHeight),
        dWidth: residueWidth * (sequencePositionEnd - sequencePositionStart + 1),
        dHeight: residueHeight * (visibleSequenceIndexEnd - visibleSequenceIndexStart + 1),
      })
    } else {
      const alignment = avStore.get("alignment") as TAlignment
      const sprites = avStore.get("sprites") as Sprites
      const dpr = window.devicePixelRatio
      this.backgroundShape.attr({
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
        sequence = alignment.referenceSequence?.sequence
      } else if (sequenceIndex === "$$consensus$$") {
        sequence = alignment.consensusSequence?.sequence
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
        alignment.consensusSequence.sequence.substring(sequencePositionStart, sequencePositionEnd + 1)
      )
      
      for (let i = 0; i < mask.length; ++i) {
        img[i] = mask[i] ? sprites.get(sequence[i]) : sprites.get(" ")
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
    const visibleSequencePositionStart = avStore.get("visibleSequencePositionStart") as number
    const alignment = avStore.get("alignment") as TAlignment
    
    const sequenceIndex = this.getMeta().fieldValue
    let sequence: string
    if (sequenceIndex === "$$overview$$") { // should never reach here
      return
    } else if (sequenceIndex === "$$reference$$") {
      sequence = alignment.referenceSequence?.sequence
    } else if (sequenceIndex === "$$consensus$$") {
      sequence = alignment.consensusSequence?.sequence
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
      alignment.consensusSequence.sequence.substring(sequencePositionStart, sequencePositionEnd + 1)
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
    const visibleSequencePositionStart = avStore.get("visibleSequencePositionStart") as number
    const visibleSequenceIndexStart = avStore.get("visibleSequenceIndexStart") as number
    const visibleSequenceIndexEnd = avStore.get("visibleSequenceIndexEnd") as number
    
    if (sequenceIndex === "$$overview$$") {
      ctx.drawImage(
        minimapImage,
        sequencePositionStart,
        visibleSequenceIndexStart,
        sequencePositionEnd - sequencePositionStart + 1,
        visibleSequenceIndexEnd - visibleSequenceIndexStart + 1,
        (sequencePositionStart - visibleSequencePositionStart) * residueWidth * dpr,
        0,
        (sequencePositionEnd - sequencePositionStart + 1) * residueWidth * dpr,
        (visibleSequenceIndexEnd - visibleSequenceIndexStart + 1) * residueHeight * dpr,
      )  
    }
  }
  */

  getContextualInfo(event: GraphEvent, target: S2CellType, viewMeta: ViewMeta, iconName?: string): TContextualInfo {
    const spreadsheet = viewMeta.spreadsheet as AVTableSheet
    const avStore = spreadsheet.avStore
    const alignment = avStore.get("alignment") as TAlignment

    let info: TContextualInfo | undefined = super.getContextualInfo(event, target, viewMeta, iconName)
    info.content = []
    const residueIndex = info.residueIndex as number
    const sequenceIndex = info.sequenceIndex

    let sequence
    if (sequenceIndex === "$$reference$$") {
      sequence = alignment.referenceSequence
    } else if (sequenceIndex === "$$consensus$$") {
      sequence = alignment.consensusSequence
    } else if (Number.isInteger(sequenceIndex)) {
      sequence = alignment.sequences[sequenceIndex as number]
    }
    
    if (!!sequence) {
      let residue = sequence.sequence[residueIndex]
      if (!!residue) {
        // residue = AA1to3[residue.toUpperCase()] ?? residue

        let residueNumber: number | string
        if (sequenceIndex === "$$consensus$$") {
          residueNumber = residueIndex + 1
        } else {
          residueNumber = ""
          if (/[A-Z]/i.test(residue)) {
            residueNumber = sequence.__begin__ - 1
            for (let i = 0; i <= residueIndex; ++i) {
              if (/[A-Z]/i.test(sequence.sequence[i])) {
                ++residueNumber
              }
            }  
          }          
        }
        info.content.push(<div key="residue" className="residue">{`${residue} ${residueNumber}`}</div>)
      }
    }
    
    return info
  }
}

export class BarDataCell extends TableDataCellWithEventsAndSequence {
  protected getBarHeightRatios(start: number, end: number): number[] {
    const avStore = (this.spreadsheet as AVTableSheet).avStore
    const alignment = avStore.get("alignment") as TAlignment
    if (!!!alignment) {
      return []
    }

    switch (this.getMeta().fieldValue) {
      case "$$entropy$$":
        return alignment.entropy.slice(start, end + 1)
      case "$$conservation$$":
        return alignment.conservation.slice(start, end + 1)
      case "$$coverage$$":
        return alignment.positionalCoverage.slice(start, end + 1)
      case "$$kl divergence$$": 
      return alignment.klDivergence.slice(start, end + 1)
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
    const avStore = (this.spreadsheet as AVTableSheet).avStore
    const visibleSequencePositionStart = avStore.get("visibleSequencePositionStart") as number
    const barSprites = avStore.get("barSprites") as BarSprites
    const dimensions = avStore.get("dimensions") as TDimensions
    const alignment = avStore.get("alignment") as TAlignment

    const { residueWidth, residueFontWidth } = dimensions
    const { x: cellX, y: cellY, height: cellHeight } = this.getCellArea()
    const dpr = window.devicePixelRatio
    this.backgroundShape.attr({
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

    let barHeightRatios: number[]
    switch (this.getMeta().fieldValue) {
      case "$$entropy$$":
        barHeightRatios = alignment.entropy
        break
      case "$$conservation$$":
        barHeightRatios = alignment.conservation
        break
      case "$$coverage$$":
        barHeightRatios = alignment.positionalCoverage
        break
      case "$$kl divergence$$": 
        barHeightRatios = alignment.klDivergence
        break
      default:
        barHeightRatios = []
    }

    const img = this.backgroundShape.attr('img') as (OffscreenCanvas | ImageData | undefined)[]
    for (let i = sequencePositionStart, j = i - visibleSequencePositionStart; i <= sequencePositionEnd; ++i, ++j) {
      img[j] = barSprites.get(barHeightRatios[i])
    }
  }

  getContextualInfo(event: GraphEvent, target: S2CellType, viewMeta: ViewMeta, iconName?: string): TContextualInfo {
    const spreadsheet = viewMeta.spreadsheet as AVTableSheet
    const avStore = spreadsheet.avStore
    const alignment = avStore.get("alignment") as TAlignment

    let info: TContextualInfo | undefined = super.getContextualInfo(event, target, viewMeta, iconName)
    const residueIndex = info.residueIndex as number
    const sequenceIndex = info.sequenceIndex as keyof typeof SPECIAL_ROWS
    const key = sequenceIndex
    const className = sequenceIndex
    let value, digits
    switch (sequenceIndex) {
      case "$$coverage$$":
        value = alignment.positionalCoverage[residueIndex] * 100
        digits = 0
        break
      case "$$conservation$$":
        value = alignment.conservation[residueIndex]
        digits = 2
        break
      case "$$entropy$$":
        value = alignment.entropy[residueIndex]
        digits = 2
        break
      case "$$kl divergence$$":
        value = alignment.klDivergence[residueIndex]
        digits = 2
        break
    }

    let text = SPECIAL_ROWS[sequenceIndex].label
    if (!isNil(value)) {
      text += ": " + value.toFixed(digits)
    }

    info.content = [<div key={key} className={className}>{text}</div>]
    return info
  }
}


export class LogoDataCell extends TableDataCellWithEventsAndSequence {
  drawSpecificContent(sequencePositionStart: number, sequencePositionEnd: number): void {
    const avStore = (this.spreadsheet as AVTableSheet).avStore
    const visibleSequencePositionStart = avStore.get("visibleSequencePositionStart") as number
    const alignment = avStore.get("alignment") as TAlignment
    const sequenceIndex = this.getMeta().fieldValue as string | number
    let sequenceLogos: SequenceLogos
    if (alignment.groupBy && isNumber(sequenceIndex)) {
      const groupIndex = alignment.sequences[sequenceIndex].__groupIndex__
      const sequenceLogosGroups = avStore.get("sequenceLogosGroups") as SequenceLogosGroups
      sequenceLogos = sequenceLogosGroups.get(groupIndex) as SequenceLogos
    } else {
      sequenceLogos = avStore.get("sequenceLogos") as SequenceLogos
    }
    const dimensions = avStore.get("dimensions") as TDimensions
    const { residueWidth, residueFontWidth } = dimensions
    const { x: cellX, y: cellY, height: cellHeight } = this.getCellArea()
    const dpr = window.devicePixelRatio

    this.backgroundShape.attr({
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
  
    const img = this.backgroundShape.attr('img') as (OffscreenCanvas | ImageData | undefined)[]
    for (let i = sequencePositionStart, j = i - visibleSequencePositionStart; i <= sequencePositionEnd; ++i, ++j) {
      img[j] = sequenceLogos.get(i)
    }
  }

  getContextualInfo(event: GraphEvent, target: S2CellType, viewMeta: ViewMeta, iconName?: string): TContextualInfo {
    const spreadsheet = viewMeta.spreadsheet as AVTableSheet
    const avStore = spreadsheet.avStore
    const alignment = avStore.get("alignment") as TAlignment

    let info: TContextualInfo | undefined = super.getContextualInfo(event, target, viewMeta, iconName)
    const residueIndex = info.residueIndex as number
    const sequenceIndex = info.sequenceIndex
    const key = sequenceIndex
    const className = sequenceIndex

    let pssm: number[], sortedIndices: number[]
    if (isNumber(sequenceIndex)) {
      const groupIndex = alignment.sequences[sequenceIndex].__groupIndex__
      pssm = alignment.groups[groupIndex].pssm[residueIndex]
      sortedIndices = alignment.groups[groupIndex].pssmSortedIndices[residueIndex]
    } else {
      pssm = alignment.pssm[residueIndex]
      sortedIndices = alignment.pssmSortedIndices[residueIndex]  
    }

    if (pssm && sortedIndices) {
      info.content = []
      let lessThan1pct = ""
      for (let j = sortedIndices.length - 1; j >= 0; --j) {
        const i = sortedIndices[j]
        if ((i === ALPHABET.length) || (pssm[i] === 0)) { // gap or not exist
          continue
        }
        const pct = Math.round(pssm[i] * 100)
        if (pct > 0) {
          info.content.push(
            <div key={`${key} ${i}`} className={className}>{`${ALPHABET[i]} ${pct}%`}</div>
          )
        } else {
          lessThan1pct += ALPHABET[i]
        }
      }

      if (lessThan1pct !== "") {
        info.content.push(
          <div key={`${key} lessThan1pct`} className={className}>{`${lessThan1pct} < 1%`}</div>
        )
      }
    } else {
      info.content = [<div key={key} className={className}>{SPECIAL_ROWS[sequenceIndex].label}</div>]
    }

    return info
  }
}

