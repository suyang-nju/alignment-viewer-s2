import type { TextTheme } from '@antv/s2'

import { TableDataCellWithEvents } from './base'

export class TextDataCell extends TableDataCellWithEvents {
  protected getTextStyle(): TextTheme {
    return {
      ...super.getTextStyle(),
      textAlign: "left",
    }
  }
}
