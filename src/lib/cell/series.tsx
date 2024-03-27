import type { FormatResult } from '@antv/s2'

import { renderRect, renderIcon } from '@antv/s2'

import { TableSeriesCellWithEvents } from './base'

export class SequenceSeriesCell extends TableSeriesCellWithEvents {
  protected drawInteractiveBgShape() {
    this.stateShapes.set(
      'interactiveBgShape',
      renderRect(
        this,
        {
          ...this.getCellArea(),
          width: this.theme.rowCell?.cell?.interactionState?.hover?.borderWidth ?? 4,
        },
        {
          visible: false,
        },
      ),
    );
  }

  protected getFormattedFieldValue(): FormatResult {
    const rowIndex = this.getMeta().rowIndex
    const firstSequenceRowIndex = this.spreadsheet.avStore.firstSequenceRowIndex

    const row = rowIndex - firstSequenceRowIndex + 1 // 1-based
    return {
      formattedValue: (row > 0) ? `${row}` : "",
      value: rowIndex
    }
  }

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

    if (alignment?.groupBy === undefined) {
      return
    }

    const viewMeta = this.getMeta()
    const firstSequenceRowIndex = avStore.firstSequenceRowIndex
    const sortedDisplayedIndices = avStore.sortedDisplayedIndices
    const i = viewMeta.rowIndex - firstSequenceRowIndex
    if (i < 0) {
      return
    }
    
    const sequenceIndex = sortedDisplayedIndices[i]
    if (alignment.annotations.__groupSize__[sequenceIndex] === 1) {
      return
    }

    const prevRowSequenceIndex = (i === 0) ? undefined : sortedDisplayedIndices[i - 1]
    const nextRowSequenceIndex = (i === sortedDisplayedIndices.length - 1) ? undefined : sortedDisplayedIndices[i + 1]

    const groupIndex = alignment.annotations.__groupIndex__[sequenceIndex]
    const prevRowGroupIndex = (prevRowSequenceIndex === undefined) ? undefined : alignment.annotations.__groupIndex__[prevRowSequenceIndex]
    const nextRowGroupIndex = (nextRowSequenceIndex === undefined) ? undefined : alignment.annotations.__groupIndex__[nextRowSequenceIndex]

    const collapsedGroups = avStore.collapsedGroups
    let iconName: string
    if (groupIndex !== prevRowGroupIndex) {
      iconName = collapsedGroups.includes(groupIndex) ? "AntdPlus" : "AntdMinus"
    } else if (groupIndex !== nextRowGroupIndex) {
      iconName = "L"
    } else {
      iconName = "|"
    }                

    const iconPosition = this.getIconPosition()
    const {size: iconSize = avStore.dimensions.iconSize} = this.getIconStyle() ?? {}
    const fill = this.spreadsheet.theme.rowCell?.text?.fill
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
