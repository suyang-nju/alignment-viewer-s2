import type { IShape, Event as GraphEvent } from '@antv/g-canvas'
import type { TextTheme } from '@antv/s2'
import type { ReactNode } from 'react'

import type { TAVMouseEventInfo } from '../types'
import type { AVTableSheet } from '../AVTableSheet'

import {
  TableColCell,
  TableSeriesCell, 
  TableDataCell, 
  CellTypes,
  GuiIcon,
  InteractionStateName,
  getEllipsisText,
  getEmptyPlaceholder,
  renderText,
  getTextAndFollowingIconPosition,
} from '@antv/s2'
import { Shape, Canvas as GCanvas } from '@antv/g-canvas'
import { debounce, isEmpty, isNil, isNumber } from 'lodash'
import { ShapeBaseSupportingOffscreenCanvas } from '../OffscreenCanvas'

interface ITableCellWithEvent {
  getMouseEventInfo(event: GraphEvent): TAVMouseEventInfo
  onClick(info: TAVMouseEventInfo): void
}

interface ITableCellWithEventAndSequence extends ITableCellWithEvent {
  renderedSequencePositionStart: number | undefined
  renderedSequencePositionEnd: number | undefined

  drawContent(): void
  // drawSpecificContent(sequencePositionStart: number, sequencePositionEnd: number): void
}

export class TableColCellWithEvents extends TableColCell implements ITableCellWithEvent {
  declare protected spreadsheet: AVTableSheet

  getMouseEventInfo(event: GraphEvent): TAVMouseEventInfo {
    return getMouseEventInfo(event, this.spreadsheet, this)
  }

  onClick(info: TAVMouseEventInfo) {

  }
}

export class TableSeriesCellWithEvents extends TableSeriesCell implements ITableCellWithEvent {
  declare protected spreadsheet: AVTableSheet

  getMouseEventInfo(event: GraphEvent): TAVMouseEventInfo {
    return getMouseEventInfo(event, this.spreadsheet, this)
  }

  onClick(info: TAVMouseEventInfo) {

  }
}

export class TableDataCellWithEventsBasic extends TableDataCell implements ITableCellWithEvent {
  declare protected spreadsheet: AVTableSheet

  getMouseEventInfo(event: GraphEvent): TAVMouseEventInfo {
    return getMouseEventInfo(event, this.spreadsheet, this)
  }

  onClick(info: TAVMouseEventInfo) {

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
  }
}

export class TableDataCellWithEvents extends TableDataCellWithEventsBasic implements ITableCellWithEvent {
  declare protected spreadsheet: AVTableSheet
  protected groupAppendixShape?: IShape
  protected lineHeight = 0

  protected initCell(): void {
    this.lineHeight = this.spreadsheet.options.avExtraOptions.dimensions.rowHeight
    super.initCell()
    this.drawGroupAppendixShape()
  }

  getContentArea(): { x: number; y: number; width: number; height: number; } {
    const area = super.getContentArea()
    if (this.spreadsheet.options.avExtraOptions.isCollapsedGroupAtRowIndex[this.getMeta().rowIndex]) {
      area.height -= this.lineHeight
    }
    return area
  }

  protected getTextStyle(): TextTheme {
    let style = super.getTextStyle()
    if (this.getMeta().fieldValue === undefined) {
      style = {
        ...style,
        fontStyle: "italic" as const,
        opacity: 0.2,
      }
    }
    return style
  }
  protected drawGroupAppendixShape(): void {
    const spreadsheet = this.spreadsheet
    const avExtraOptions = spreadsheet.options.avExtraOptions
    if (avExtraOptions.isOverviewMode) {
      return
    }

    const viewMeta = this.getMeta()
    const alignment = avExtraOptions.alignment

    if (!alignment) {
      return
    }
    
    if (!avExtraOptions.isCollapsedGroupAtRowIndex[viewMeta.rowIndex]) {
      return
    }

    const groupSize = avExtraOptions.groupSizeAtRowIndex[viewMeta.rowIndex]
    const groupAppendix = (viewMeta.valueField === alignment.groupBy) ? `(${groupSize})` : "…"

    const maxTextWidth = this.getMaxTextWidth()
    const {
      options: { placeholder = "N/A" },
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
}

export class TableColCellWithEventsAndSequence extends TableColCellWithEvents implements ITableCellWithEventAndSequence {
  renderedSequencePositionStart: number | undefined = undefined
  renderedSequencePositionEnd: number | undefined = undefined

  protected drawTextShape(): void {}

  getMouseEventInfo(event: GraphEvent): TAVMouseEventInfo {
    return getMouseEventInfoWithSequence(event, this.spreadsheet, this)
  }

  drawContent(): void {
    drawContent(this.spreadsheet, this)
  }
}

export class TableDataCellWithEventsAndSequence extends TableDataCellWithEventsBasic implements ITableCellWithEventAndSequence {
  spriteShape?: IShape
  spriteShapes?: IShape[]
  renderedSequencePositionStart: number | undefined = undefined
  renderedSequencePositionEnd: number | undefined = undefined
  // renderingHeight: number = 0

  getShapeBase(): typeof Shape {
    return ShapeBaseSupportingOffscreenCanvas
  }

  getMouseEventInfo(event: GraphEvent): TAVMouseEventInfo {
    return getMouseEventInfoWithSequence(event, this.spreadsheet, this)
  }

  protected drawTextShape(): void {}

  drawContent(): void {
    drawContent(this.spreadsheet, this)
  }

  drawSpecificContent(sequencePositionStart: number, sequencePositionEnd: number): void {
    
  }

}


function getGuiIcon(target: GraphEvent['target']) {
  let parent = target
  while (parent && !(parent instanceof GCanvas)) {
    if (parent instanceof GuiIcon) {
      return parent
    }
    parent = parent.get?.('parent')
  }
  return null
}

function getMouseEventInfo(event: GraphEvent, spreadsheet: AVTableSheet, cell: TableColCell | TableSeriesCell | TableDataCell): TAVMouseEventInfo {
  const viewMeta = cell.getMeta()
  const icon = getGuiIcon(event.target)
  const iconName = icon?.get("name")

  let rowIndex: number, colIndex: number
  switch (cell.cellType) {
    case CellTypes.DATA_CELL:
      rowIndex = viewMeta.rowIndex
      colIndex = viewMeta.colIndex
      break
    case CellTypes.COL_CELL:
      rowIndex = -1
      colIndex = viewMeta.colIndex
      break
    case CellTypes.ROW_CELL:
      rowIndex = viewMeta.rowIndex
      colIndex = -1
      break
    default:
      rowIndex = -1
      colIndex = -1
  }
  
  const options = spreadsheet.options
  const avExtraOptions = options.avExtraOptions

  const sequenceRowIndex = (rowIndex < avExtraOptions.firstSequenceRowIndex) ? -1 : (rowIndex - avExtraOptions.firstSequenceRowIndex)
  const sequencePosition = -1

  const facet = spreadsheet.facet
  const colLeafNodes = facet.layoutResult.colLeafNodes
  const colHeaderHeight = facet.cornerBBox.height
  const { scrollX = 0, scrollY = 0 } = facet.getScrollOffset()
  const { width: canvasWidth, height: canvasHeight} = facet.getCanvasHW()
  
  const frozenRowCount = options.frozenRowCount ?? 0
  const frozenColCount = options.frozenColCount ?? 0
  const frozenTrailingColCount = options.frozenTrailingColCount ?? 0
  const minX = facet.viewCellWidths[frozenColCount]
  const maxX = frozenTrailingColCount ? colLeafNodes[colLeafNodes.length - frozenTrailingColCount].x : canvasWidth - options.avExtraOptions.scrollbarSize
  const minY = facet.viewCellHeights.getCellOffsetY(frozenRowCount)
  const maxY = canvasHeight - options.avExtraOptions.scrollbarSize - colHeaderHeight

  const { x: cellX, y: cellY, width: cellWidth, height: cellHeight} = cell.getCellArea()
  let top = cellY, bottom = cellY + cellHeight, left = cellX, right = cellX + cellWidth
  let topClip = false, bottomClip = false, leftClip = false, rightClip = false

  if ((colIndex >= frozenColCount) && (colIndex < colLeafNodes.length - frozenTrailingColCount)) {
    left -= scrollX
    right -= scrollX

    if (left < minX) {
      leftClip = true
      left = minX
    } 
    
    if (right > maxX) {
      rightClip = true
      right = maxX
    }
  }

  if (rowIndex >= frozenRowCount) {
    top -= scrollY
    bottom -= scrollY

    if (top < minY) {
      topClip = true
      top = minY
    }
    
    if (bottom > maxY) {
      bottomClip = true
      bottom = maxY
    }
  }

  if (cell.cellType !== CellTypes.COL_CELL) {
    top += colHeaderHeight
    bottom += colHeaderHeight
  }

  const sequenceIndex: string | number | undefined = (rowIndex < 0) ? undefined : spreadsheet.dataSet.getCellData({ query: { rowIndex }}).__sequenceIndex__
  
  const alignment = avExtraOptions.alignment
  let sequenceId: string | undefined = undefined
  const extraInfo: ReactNode[] = []
  if (alignment) {
    let restOfGroup: number | undefined = undefined
    if (alignment.groupBy && isNumber(sequenceIndex)) {
      const groupIndex = alignment.annotations.__groupIndex__[sequenceIndex]
      const collapsedGroups = avExtraOptions.collapsedGroups
      if (collapsedGroups.includes(groupIndex)) {
        restOfGroup = alignment.annotations.__groupSize__[sequenceIndex] - 1
      }
    }

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

    if (!isNil(viewMeta.fieldValue)) {
      const fieldName = alignment.annotationFields[viewMeta.valueField]?.name
      let fieldContent = `${viewMeta.fieldValue}`
      if (restOfGroup) {
        fieldContent += ` + ${restOfGroup} others`
      }
      extraInfo.push(<div key="other" className="other">{fieldName}: {fieldContent}</div>)
    }
  }

  return {
    event, 
    cell, 
    viewMeta, 
    iconName, 

    rowIndex, 
    colIndex, 
    sequencePosition, 
    sequenceRowIndex,
    visible: { top, bottom, left, right, width: right - left, height: bottom - top },
    clip: { top: topClip, bottom: bottomClip, left: leftClip, right: rightClip },

    key: `${viewMeta.id} ${sequenceIndex} ${sequencePosition}`,
    sequenceIndex,
    sequenceId,
    extraInfo,      
  }
}

export function drawContent(spreadsheet: AVTableSheet, cell: TableDataCellWithEventsAndSequence): void {
  if (cell.getMeta().height === 0) {
    if (cell.spriteShape && cell.contain(cell.spriteShape)) {
      cell.removeChild(cell.spriteShape, true)
      cell.spriteShape = undefined
    }
    return
  }

  if (cell.spriteShape && !cell.contain(cell.spriteShape)) {
    cell.spriteShape = undefined
  }
  
  if (isNil(cell.spriteShape)) {
    cell.spriteShape = cell.addShape('offscreenCanvas', {
      // zIndex: 1,
      attrs: {
        img: [],
        imageSmoothingEnabled: false,
      }
    })
  }

  const { x: cellX, y: cellY, width: cellWidth, height: cellHeight } = cell.getCellArea()
  cell.spriteShape.attr({
    x: cellX,
    y: cellY,
    width: cellWidth,
    height: cellHeight,
  })

  // const spreadsheet = this.spreadsheet as AVTableSheet
  // const avExtraOptions = spreadsheet.options.avExtraOptions
  const visibleSequencePositionStart = spreadsheet.visibleSequencePositionStart
  const visibleSequencePositionEnd = spreadsheet.visibleSequencePositionEnd

  cell.drawSpecificContent(visibleSequencePositionStart, visibleSequencePositionEnd)
  const img = cell.spriteShape.attr('img') as (OffscreenCanvas | ImageData | undefined)[]
  if (cell.getMeta().fieldValue === "$$overview$$") {
    for (let i = 1; i < img.length; ++i) {
      img[i] = undefined
    }
  } else {
    for (let i = visibleSequencePositionEnd - visibleSequencePositionStart + 1; i < img.length; ++i) {
      img[i] = undefined
    }  
  }
  cell.renderedSequencePositionStart = visibleSequencePositionStart
  cell.renderedSequencePositionEnd = visibleSequencePositionEnd
}

function getMouseEventInfoWithSequence(event: GraphEvent, spreadsheet: AVTableSheet, cell: TableColCellWithEventsAndSequence | TableDataCellWithEventsAndSequence): TAVMouseEventInfo {
  const avmei: TAVMouseEventInfo = getMouseEventInfo(event, spreadsheet, cell)
  const avExtraOptions = spreadsheet.options.avExtraOptions
  const dimensions = avExtraOptions.dimensions
  const alignment = avExtraOptions.alignment

  if (dimensions && alignment) {
    const viewMeta = cell.getMeta()
    const facet = spreadsheet.facet
    const { scrollX = 0, scrollY = 0 } = facet.getScrollOffset()
    
    avmei.sequencePosition = Math.floor((event.x + scrollX - viewMeta.x) / dimensions.residueWidth)
    if (viewMeta.fieldValue === "$$overview$$") {
      const height = dimensions.residueHeight
      avmei.sequenceRowIndex = Math.floor((event.y - facet.columnHeader.getBBox().height + scrollY - viewMeta.y) / height)

      const filteredSortedDisplayedIndices = avExtraOptions.filteredSortedDisplayedIndices
      avmei.sequenceIndex = filteredSortedDisplayedIndices[avmei.sequenceRowIndex]
      avmei.sequenceId = alignment.annotations.__id__[avmei.sequenceIndex]

      avmei.visible.height = height
      
      const top = avmei.visible.top + avmei.sequenceRowIndex * height - scrollY
      if (top > avmei.visible.top) {
        avmei.visible.top = top
        avmei.clip.top = false
      }

      const bottom = top + height
      if (bottom < avmei.visible.bottom) {
        avmei.visible.bottom = bottom
        avmei.clip.bottom = false
      }
    }

    const width = dimensions.residueWidth
    avmei.visible.width = width

    const left = viewMeta.x + avmei.sequencePosition * width - scrollX
    if (left > avmei.visible.left) {
      avmei.visible.left = left
      avmei.clip.left = false
    }

    const right = left + width
    if (right < avmei.visible.right) {
      avmei.visible.right = right
      avmei.clip.right = false
    }
  }

  avmei.key = `${avmei.viewMeta.id} ${avmei.sequenceIndex} ${avmei.sequencePosition}`
  return avmei
}

