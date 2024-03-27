import type { Event as GraphEvent } from '@antv/g-canvas'
import type { Node as S2Node, ViewMeta, S2CellType } from '@antv/s2'
import type { TNormalizedPosition, TContextualInfo, TAVMouseEventInfo } from '../types'
import type { AVTableSheet } from '../AVTableSheet'

import {
  TableColCell,
  TableSeriesCell, 
  TableDataCell, 
  CellTypes,
} from '@antv/s2'

interface ITableCellWithEvent {
  getNormalizedPosition(event: GraphEvent, target: S2CellType, viewMeta: ViewMeta | S2Node): TNormalizedPosition
  getContextualInfo(event: GraphEvent, target: S2CellType, viewMeta: ViewMeta | S2Node, iconName?: string): TContextualInfo | undefined
  onClick(info: TAVMouseEventInfo): void
}

function getNormalizedPosition(event: GraphEvent, target: S2CellType, viewMeta: ViewMeta | S2Node): TNormalizedPosition {
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

export class TableColCellWithEvents extends TableColCell implements ITableCellWithEvent {
  declare protected spreadsheet: AVTableSheet

  getNormalizedPosition(event: GraphEvent, target: S2CellType, viewMeta: ViewMeta | S2Node): TNormalizedPosition {
    return getNormalizedPosition.call(this, event, target, viewMeta)
  }

  getContextualInfo(event: GraphEvent, target: S2CellType, viewMeta: ViewMeta | S2Node, iconName?: string): TContextualInfo {
    const { scrollX = 0, scrollY = 0 } = spreadsheet.facet.getScrollOffset()
    const frozenColCount = this.spreadsheet.options.frozenColCount ?? 0
    const frozenColGroupWidth = this.spreadsheet.facet.viewCellWidths[frozenColCount]
    let anchorX = viewMeta.x
    let anchorWidth = viewMeta.width
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

    return {
      key: viewMeta.id,
      sequenceIndex: undefined,
      residueIndex: undefined,
      row: undefined,
      col: undefined,
      sequenceId: undefined,
      content: ReactNode[],
      anchorX,
      anchorY: number,
      anchorWidth,
      anchorHeight: number,    
    }
  }

  onClick(info: TAVMouseEventInfo) {

  }
}

export class TableSeriesCellWithEvents extends TableSeriesCell implements ITableCellWithEvent {
  declare protected spreadsheet: AVTableSheet

  getNormalizedPosition(event: GraphEvent, target: S2CellType, viewMeta: ViewMeta | S2Node): TNormalizedPosition {
    return getNormalizedPosition.call(this, event, target, viewMeta)
  }

  getContextualInfo(event: GraphEvent, target: S2CellType, viewMeta: ViewMeta | S2Node, iconName?: string): TContextualInfo | undefined {
    return getContextualInfo.call(this, event, target, viewMeta, iconName)
  }

  onClick(info: TAVMouseEventInfo) {

  }
}

export class TableDataCellWithEvents extends TableDataCell implements ITableCellWithEvent {
  declare protected spreadsheet: AVTableSheet

  getNormalizedPosition(event: GraphEvent, target: S2CellType, viewMeta: ViewMeta | S2Node): TNormalizedPosition {
    return getNormalizedPosition.call(this, event, target, viewMeta)
  }

  getContextualInfo(event: GraphEvent, target: S2CellType, viewMeta: ViewMeta | S2Node, iconName?: string): TContextualInfo | undefined {
    return getContextualInfo.call(this, event, target, viewMeta, iconName)
  }

  onClick(info: TAVMouseEventInfo) {

  }
}


function getContextualInfo(event: GraphEvent, target: S2CellType, viewMeta: ViewMeta | S2Node, iconName?: string): TContextualInfo | undefined {

}
