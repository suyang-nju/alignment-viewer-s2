import type {
  S2CellType, 
  ViewMeta, 
  Node as S2Node, 
} from '@antv/s2'
import type { IShape, Event as GraphEvent } from '@antv/g-canvas'
import type { ReactNode } from 'react'

import type {
  TConstructor,
  TContextualInfo, 
  TNormalizedPosition,
  TAVMouseEventInfo, 
} from '../types'
import type { AVTableSheet } from '../AVTableSheet'

import { debounce, isEmpty, isNil, isNumber } from 'lodash'
import {
  TableSeriesCell, 
  TableDataCell, 
  TableColCell, 
  InteractionStateName,
  CellTypes,
  getEllipsisText,
  getEmptyPlaceholder,
  renderText,
  getTextAndFollowingIconPosition,
} from '@antv/s2'
import { Shape } from '@antv/g-canvas'

import { ShapeBaseSupportingOffscreenCanvas } from '../OffscreenCanvas'

class AVTableColCell extends TableColCell {
  declare protected spreadsheet: AVTableSheet
  
  // constructor(meta: S2Node, spreadsheet: AVTableSheet, ...restOptions: unknown[]) {
  //   super(meta, spreadsheet, ...restOptions)
  // }
}

class AVTableSeriesCell extends TableSeriesCell {
  declare protected spreadsheet: AVTableSheet

  // constructor(meta: ViewMeta, spreadsheet: AVTableSheet, ...restOptions: unknown[]) {
  //   super(meta, spreadsheet, ...restOptions)
  // }
}

class AVTableDataCell extends TableDataCell {
  declare protected spreadsheet: AVTableSheet

  // constructor(meta: ViewMeta, spreadsheet: AVTableSheet, ...restOptions: unknown[]) {
  //   super(meta, spreadsheet, ...restOptions)
  // }
}

type TAVTableCellConstructor = TConstructor<AVTableColCell> | TConstructor<AVTableSeriesCell> | TConstructor<AVTableDataCell>

function withEvents<TBase extends TAVTableCellConstructor>(Base: TBase) {
  return class BaseWithEvents extends Base {
    // public updateByState(stateName: InteractionStateName) {
    //   if (
    //     (this.spreadsheet.isCellSelected(this)) /*&& 
    //   ((stateName === InteractionStateName.HOVER) || (stateName === InteractionStateName.HOVER_FOCUS))*/
    //   ) {
    //     // console.log("cancel updateByState", stateName)
    //     super.updateByState(InteractionStateName.SELECTED)
    //   } else {
    //     // console.log("updateByState", stateName)
    //     super.updateByState(stateName)
    //   }
    // }
  
    getNormalizedPosition(event: GraphEvent, target: S2CellType, viewMeta: ViewMeta | S2Node): TNormalizedPosition {
      let rowIndex = -1
      let colIndex = -1
      const sequencePosition = -1
      const sequenceRowIndex = -1

      switch (target.cellType) {
        case CellTypes.DATA_CELL:
          rowIndex = viewMeta.rowIndex
          colIndex = viewMeta.colIndex
          break
        case CellTypes.COL_CELL:
          colIndex = viewMeta.colIndex
          break
        case CellTypes.ROW_CELL:
          rowIndex = viewMeta.rowIndex
          break
      }
      
      return { rowIndex, colIndex, sequencePosition, sequenceRowIndex }
    }
  
    getContextualInfo(event: GraphEvent, target: S2CellType, viewMeta: ViewMeta | S2Node, iconName?: string): TContextualInfo | undefined {
      const spreadsheet = this.spreadsheet as AVTableSheet
      const avStore = spreadsheet.avStore
      const firstSequenceRowIndex = avStore.firstSequenceRowIndex
      const alignment = avStore.alignment
      if (!alignment) {
        return 
      }
      const sortedDisplayedIndices = avStore.sortedDisplayedIndices
      const dimensions = avStore.dimensions
      const { scrollX = 0, scrollY = 0 } = spreadsheet.facet.getScrollOffset()

      let sequenceIndex: number | string | undefined
      let row: number | undefined
      if ((viewMeta.valueField === "__sequenceIndex__") && (viewMeta.fieldValue === "$$overview$$")) {
        row = Math.floor((event.y - viewMeta.spreadsheet.facet.columnHeader.getBBox().height + scrollY - viewMeta.y) / dimensions.residueHeight)
        sequenceIndex = sortedDisplayedIndices[row]
        ++row // adjust to 1-based
      } else {
        if (target.cellType === CellTypes.DATA_CELL) {
          row = viewMeta.rowIndex - firstSequenceRowIndex + 1 // 1-based
          if (row <= 0) {
            row = undefined
          }
  
          sequenceIndex = spreadsheet.dataSet.getCellData({
            query: {
              rowIndex: viewMeta.rowIndex
            }
          }).__sequenceIndex__  
        } else {
          sequenceIndex = undefined
          row = undefined
        }
      }

      let restOfGroup: number | undefined = undefined
      if (alignment.groupBy && isNumber(sequenceIndex)) {
        const groupIndex = alignment.annotations.__groupIndex__[sequenceIndex]
        const collapsedGroups = avStore.collapsedGroups
        if (collapsedGroups.includes(groupIndex)) {
          restOfGroup = alignment.annotations.__groupSize__[sequenceIndex] - 1
        }
      }

      let sequenceId: string | undefined = undefined
      if (sequenceIndex === "$$reference$$") {
        sequenceId = alignment.annotations.__id__[alignment.referenceSequenceIndex]
      } else if (sequenceIndex === "$$consensus$$") {
        sequenceId = "Consensus Sequence"
      } else if (isNumber(sequenceIndex)) {
        sequenceId = alignment.annotations.__id__[sequenceIndex]
        if (restOfGroup) {
          sequenceId = `Group: ${sequenceId} + ${restOfGroup} sequences`
        }
      }
  
      const panelScrollGroupClipBBox = spreadsheet.panelScrollGroup.getClip().getBBox()
      const frozenColGroupWidth = spreadsheet.frozenColGroup.getBBox().width
      // const scrollX = panelScrollGroupClipBBox.x - frozenColGroupWidth
      let residueIndex: number | undefined, col: number | undefined
      let anchorX, anchorWidth
      if ((viewMeta.valueField === "__sequenceIndex__") || (viewMeta.field === "__sequenceIndex__")) {
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
      anchorX = event.clientX
      
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
  
      const content: ReactNode[] = []
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
  
    onClick(info: TAVMouseEventInfo) {
      // implemented in subclasses
    }
  }
}

export const TableColCellWithEvents = withEvents(AVTableColCell)
export const TableSeriesCellWithEvents = withEvents(AVTableSeriesCell)
// const TableDataCellWithEvents = withEvents(AVTableDataCell)

export class TableDataCellWithEvents extends withEvents(AVTableDataCell) {
  protected groupAppendixShape?: IShape
  protected lineHeight = 0

  protected initCell(): void {
    this.lineHeight = this.spreadsheet.avStore.dimensions.rowHeight
    super.initCell()
    this.drawGroupAppendixShape()
  }

  getContentArea(): { x: number; y: number; width: number; height: number; } {
    const area = super.getContentArea()
    if (this.spreadsheet.avStore.isCollapsedGroupAtRowIndex[this.getMeta().rowIndex]) {
      area.height -= this.lineHeight
    }
    return area
  }

  protected drawGroupAppendixShape(): void {
    const spreadsheet = this.spreadsheet
    const avStore = spreadsheet.avStore
    if (avStore.isOverviewMode) {
      return
    }

    const viewMeta = this.getMeta()
    const alignment = avStore.alignment

    if (!alignment) {
      return
    }
    
    if (!avStore.isCollapsedGroupAtRowIndex[viewMeta.rowIndex]) {
      return
    }

    const groupSize = avStore.groupSizeAtRowIndex[viewMeta.rowIndex]
    const groupAppendix = (viewMeta.valueField === alignment.groupBy) ? `(${groupSize})` : "…"

    const maxTextWidth = this.getMaxTextWidth()
    const {
      options: { placeholder = "" },
      measureTextWidth,
    } = this.spreadsheet
    const emptyPlaceholder = getEmptyPlaceholder(this, placeholder)

    const textStyle = this.getTextStyle()
    const groupAppendixTextStyle = {
      ...textStyle,
      fontStyle: "italic" as const,
      opacity: 0.5,
      // fill:
    }
    const groupAppendixEllipsisText = getEllipsisText({
      measureTextWidth,
      text: groupAppendix,
      maxWidth: maxTextWidth,
      fontParam: groupAppendixTextStyle,
      placeholder: emptyPlaceholder,
    })
    const groupAppendixTextWidth = measureTextWidth(groupAppendixEllipsisText, groupAppendixTextStyle)

    const area = super.getContentArea()
    area.y += area.height - this.lineHeight
    area.height = this.lineHeight

    const iconCfg = this.getIconStyle();
    const position = getTextAndFollowingIconPosition(
      area,
      groupAppendixTextStyle,
      groupAppendixTextWidth,
      iconCfg,
      0,
    )

    this.groupAppendixShape = renderText(
      this,
      this.groupAppendixShape ? [this.groupAppendixShape] : [],
      position.text.x,
      position.text.y,
      groupAppendixEllipsisText,
      groupAppendixTextStyle,
    )
  }

  public updateByState(stateName: InteractionStateName) {
    switch (stateName) {
      case InteractionStateName.PREPARE_SELECT:
      case InteractionStateName.SELECTED:
      case InteractionStateName.ALL_SELECTED:
      case InteractionStateName.BRUSH_SELECTED:
      case InteractionStateName.UNSELECTED:
        return
    }

    super.updateByState(stateName)
    // if (
    //   (this.spreadsheet.isCellSelected(this)) /*&& 
    // ((stateName === InteractionStateName.HOVER) || (stateName === InteractionStateName.HOVER_FOCUS))*/
    // ) {
    //   // console.log("cancel updateByState", stateName)
    //   super.updateByState(InteractionStateName.SELECTED)
    // } else {
    //   // console.log("updateByState", stateName)
    //   super.updateByState(stateName)
    // }
  }
}


function withSequence<TBase extends TConstructor<AVTableColCell> | TConstructor<AVTableDataCell>>(Base: TBase) {
  return class BaseWithSequence extends Base {
    spriteShape?: IShape
    spriteShapes?: IShape[]
    renderedSequencePositionStart: number | undefined = undefined
    renderedSequencePositionEnd: number | undefined = undefined
    renderingHeight = 0

    getShapeBase(): typeof Shape {
      return ShapeBaseSupportingOffscreenCanvas
    }
  
    protected drawTextShape(): void {}

    // protected drawBackgroundShape(): void {}

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
      const visibleSequencePositionStart = (this.spreadsheet as AVTableSheet).visibleSequencePositionStart
      const visibleSequencePositionEnd = (this.spreadsheet as AVTableSheet).visibleSequencePositionEnd
      const visibleSequenceRowIndexStart = (this.spreadsheet as AVTableSheet).visibleSequenceRowIndexStart
      const visibleSequenceRowIndexEnd = (this.spreadsheet as AVTableSheet).visibleSequenceRowIndexEnd

      if (visibleSequencePositionStart < 0) {
        // console.log("visible", visibleSequencePositionStart, visibleSequencePositionEnd, visibleSequenceRowIndexStart, visibleSequenceRowIndexEnd)
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
        ? dpr * residueHeight * (visibleSequenceRowIndexEnd - visibleSequenceRowIndexStart + 1)
        : dpr * cellHeight
      )

      const attrs = {
        x: cellX + visibleSequencePositionStart * residueWidth,
        y: (sequenceIndex === "$$overview$$") ? (cellY + visibleSequenceRowIndexStart * residueHeight) : cellY,
        width: renderingWidth / dpr,
        height: this.renderingHeight / dpr,
        sx: 0,
        sy: 0,
        sWidth: renderingWidth,
        sHeight: this.renderingHeight,
        dx: cellX + visibleSequencePositionStart * residueWidth,
        dy: (sequenceIndex === "$$overview$$") ? (cellY + visibleSequenceRowIndexStart * residueHeight) : cellY,
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
        if (this.contain(this.spriteShape)) {
          this.removeChild(this.spriteShape, true)
          this.spriteShape = undefined
          console.log('remove child height === 0')
        }
        return
      }
  
      if (!this.contain(this.spriteShape)) {
        this.spriteShape = undefined
      }
      
      if (isNil(this.spriteShape)) {
        this.spriteShape = this.addShape('offscreenCanvas', {
          // zIndex: 1,
          attrs: {
            img: [],
            imageSmoothingEnabled: false,
          }
        })
      }
  
      const { x: cellX, y: cellY, width: cellWidth, height: cellHeight } = this.getCellArea()
      this.spriteShape.attr({
        x: cellX,
        y: cellY,
        width: cellWidth,
        height: cellHeight,
      })

      const spreadsheet = this.spreadsheet as AVTableSheet
      const avStore = spreadsheet.avStore
      const visibleSequencePositionStart = (this.spreadsheet as AVTableSheet).visibleSequencePositionStart
      const visibleSequencePositionEnd = (this.spreadsheet as AVTableSheet).visibleSequencePositionEnd
  
      this.drawSpecificContent(visibleSequencePositionStart, visibleSequencePositionEnd)
      const img = this.spriteShape.attr('img') as (OffscreenCanvas | ImageData | undefined)[]
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

    getNormalizedPosition(event: GraphEvent, target: S2CellType, viewMeta: ViewMeta | S2Node): TNormalizedPosition {
      const { rowIndex, colIndex } = super.getNormalizedPosition(event, target, viewMeta)
      let sequencePosition = -1
      let sequenceRowIndex = -1

      const avStore = this.spreadsheet.avStore
      const dimensions = avStore.dimensions
      if (dimensions) {
        const facet = this.spreadsheet.facet
        const { scrollX = 0, scrollY = 0 } = facet.getScrollOffset()
        
        if (viewMeta.fieldValue === "$$overview$$") {
          sequenceRowIndex = Math.floor((event.y - facet.columnHeader.getBBox().height + scrollY - viewMeta.y) / dimensions.residueHeight)
        } else if ((target.cellType === CellTypes.DATA_CELL) && (viewMeta.rowIndex >= avStore.firstSequenceRowIndex)) {
          sequenceRowIndex = viewMeta.rowIndex - avStore.firstSequenceRowIndex
        } else {
          sequenceRowIndex = -1
        }
  
        sequencePosition = Math.floor((event.x + scrollX - viewMeta.x) / dimensions.residueWidth)
      }

      return { rowIndex, colIndex, sequencePosition, sequenceRowIndex }
    }

  }
}

export const TableColCellWithEventsAndSequence = withSequence(TableColCellWithEvents)
export const TableDataCellWithEventsAndSequence = withSequence(TableDataCellWithEvents)

// class TableDataCellWithEventsAndSequence extends withSequence(TableDataCellWithEvents) {
//   protected drawInteractiveBgShape() {
//     const spreadsheet = this.spreadsheet
//     const residueWidth = spreadsheet.avStore.dimensions.residueWidth
//     const selectedSequencePositions = spreadsheet.selectedCellsRange.sequencePosition
//     const { x: cellX, y, width: cellWidth, height, } = this.getCellArea()
//     let x = cellX, width = 0
//     if ((selectedSequencePositions[0] !== undefined) && (selectedSequencePositions[1] !== undefined)) {
//       x = cellX + selectedSequencePositions[0] * residueWidth
//       width = (selectedSequencePositions[1] - selectedSequencePositions[0] + 1) * residueWidth
//     } else {
//       // x = cellX + spreadsheet.visibleSequencePositionStart * residueWidth
//       // width = (spreadsheet.visibleSequencePositionEnd - spreadsheet.visibleSequencePositionStart + 1) * residueWidth
//       x = cellX
//       width = cellWidth
//     }

//     this.stateShapes.set(
//       'interactiveBgShape',
//       renderRect(
//         this,
//         {
//           x,
//           y,
//           height,
//           width,
//         },
//         {
//           visible: false,
//         },
//       ),
//     )
//   }

  // public updateByState(stateName: InteractionStateName) {
  //   const interactiveBgShape: IShape = this.stateShapes.get("interactiveBgShape")
  //   if (interactiveBgShape) {
  //     const spreadsheet = this.spreadsheet as AVTableSheet
  //     const residueWidth = spreadsheet.avStore.dimensions.residueWidth
  //     const { x: cellX, width: cellWidth }= this.getCellArea()

  //     let x, width
  //     if (
  //       (stateName === InteractionStateName.SELECTED) ||
  //       (stateName === InteractionStateName.BRUSH_SELECTED) ||
  //       (stateName === InteractionStateName.PREPARE_SELECT) ||
  //       (stateName === InteractionStateName.ALL_SELECTED)
  //     ) {
  //       const be: [number | undefined, number | undefined] = [undefined, undefined]
  //       const down = spreadsheet.mousedownEventInfo!.normalizedPosition
  //       const up = spreadsheet.mousemoveEventInfo!.normalizedPosition    
  //       spreadsheet._setRange(be, down.sequencePosition, up.sequencePosition, 0)
        
  //       if((be[0] === undefined) || be[1] === undefined) {
  //         be[0] = spreadsheet.visibleSequencePositionStart
  //         be[1] = spreadsheet.visibleSequencePositionEnd
  //       }

  //       if (be[0] < spreadsheet.visibleSequencePositionStart) {
  //         be[0] = spreadsheet.visibleSequencePositionStart
  //       }

  //       if (be[1] > spreadsheet.visibleSequencePositionEnd) {
  //         be[1] = spreadsheet.visibleSequencePositionEnd
  //       }

  //       x = cellX + be[0] * residueWidth
  //       width = (be[1] - be[0] + 1) * residueWidth
  //       // console.log("updateByState", stateName, be[0], be[1])
  //     } else {
  //       const selectedSequencePositions = spreadsheet.selectedCellsRange.sequencePosition
  //       if ((selectedSequencePositions[0] !== undefined) && (selectedSequencePositions[1] !== undefined)) {
  //         x = cellX + selectedSequencePositions[0] * residueWidth
  //         width = (selectedSequencePositions[1] - selectedSequencePositions[0] + 1) * residueWidth
  //       } else {
  //         // x = cellX + spreadsheet.visibleSequencePositionStart * residueWidth
  //         // width = (spreadsheet.visibleSequencePositionEnd - spreadsheet.visibleSequencePositionStart + 1) * residueWidth
  //         x = cellX
  //         width = cellWidth
  //       }
  //     }

  //     const { x: shapeX, width: shapeWidth } = interactiveBgShape.attr()
  //     if (x !== shapeX) {
  //       interactiveBgShape.attr("x", x)
  //     }

  //     if (width !== shapeWidth) {
  //       interactiveBgShape.attr("width", width)
  //     }
  //   }

  //   super.updateByState(stateName)
  // }
// }


