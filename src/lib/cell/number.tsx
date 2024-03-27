import type { TextTheme } from '@antv/s2'

import { TableDataCellWithEvents } from './base'

export class NumberDataCell extends TableDataCellWithEvents {
  protected getTextStyle(): TextTheme {
    return {
      ...super.getTextStyle(),
      textAlign: "right",
    }
  }
}
