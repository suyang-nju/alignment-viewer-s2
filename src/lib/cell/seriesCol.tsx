import { renderIcon } from '@antv/s2'

import { TableColCellWithEvents } from './base'

export class SequenceSeriesColCell extends TableColCellWithEvents {
  protected drawInteractiveBgShape() {}
  
  protected drawTextShape(): void {
    if (this.spreadsheet.avStore.isOverviewMode) {
      return
    }

    super.drawTextShape()
    this.drawGroupIconShapes()
  }

  public drawGroupIconShapes(): void {
    const avStore = this.spreadsheet.avStore
    const alignment = avStore.alignment
    if (!alignment) {
      return
    }

    if (alignment.groupBy === false) {
      return
    }

    const collapsedGroups = avStore.collapsedGroups
    let iconName = "AntdPlus"
    for (let groupIndex = 0; groupIndex < alignment.groups.length; ++groupIndex) {
      if ((alignment.groups[groupIndex].members.length > 1) && !collapsedGroups.includes(groupIndex)) {
        iconName = "AntdMinus"
        break
      }
    }

    const iconPosition = this.getIconPosition()
    const {size: iconSize = avStore.dimensions.iconSize} = this.getIconStyle() ?? {}
    const fill = this.spreadsheet.theme.rowCell?.text?.fill
    this.conditionIconShape = renderIcon(this, {
      name: iconName,
      ...iconPosition,
      width: iconSize,
      height: iconSize,
      fill,
    })
    this.addConditionIconShape(this.conditionIconShape)
  }
}
