import { TableDataCellWithEvents } from './base'

export class DummyMinimapDataCell extends TableDataCellWithEvents {
  protected drawTextShape(): void {}
  protected drawGroupAppendixShape() {}

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
  