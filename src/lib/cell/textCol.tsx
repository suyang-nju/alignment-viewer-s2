import {
  renderLine, 
  getBorderPositionAndStyle, 
  CellBorderPosition
} from '@antv/s2'

import { TableColCellWithEvents } from './base'

export class TextColCell extends TableColCellWithEvents {
  protected drawTextShape(): void {
    if (this.spreadsheet.options.avExtraOptions.isOverviewMode) {
      return
    }

    super.drawTextShape()
  }

  protected drawBorders() {
    const alignment = this.spreadsheet.options.avExtraOptions.alignment
    const viewMeta = this.getMeta()
    if (alignment?.groupBy === viewMeta.field) {
      for (const dir of Object.values(CellBorderPosition)) {
        const { position, style } = getBorderPositionAndStyle(
          dir,
          viewMeta,
          this.theme.colCell!.cell!,
        )
        style.stroke = this.theme.colCell?.text?.fill
        renderLine(this, position, style)
  
      }  
    } else {
      super.drawBorders()
    }
  }
}
