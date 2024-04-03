import type { Event as GraphEvent, IShape } from '@antv/g-canvas'
import type { S2CellType, ViewMeta } from '@antv/s2'
import type { TContextualInfo, TAVMouseEventInfo } from '../types'

import { isNumber } from 'lodash'
import { InteractionStateName } from '@antv/s2'

import { TextDataCell } from './text'

export class SequenceIdDataCell extends TextDataCell {
  protected linkTextUnderlineShape?: IShape

  protected getTextStyle() {
    const textStyle = super.getTextStyle()

    const viewMeta = this.getMeta()
    const alignment = this.spreadsheet.options.avExtraOptions.alignment
    
    const sequenceIndex = this.spreadsheet.dataSet.getCellData({
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
  protected drawTextShape(): void {
    if (this.spreadsheet.options.avExtraOptions.isOverviewMode) {
      return
    }

    super.drawTextShape()
    const { x, y, width, height } = this.textShape.getBBox()
    this.linkTextUnderlineShape = this.addShape("line", {
      attrs: {
        x1: x,
        y1: y + height,
        x2: x + width,
        y2: y + height,
        stroke: this.spreadsheet.theme.dataCell?.text?.linkTextFill,
        cursor: "pointer",
      }
    })
    this.linkTextUnderlineShape.set("visible", false)
  }

  getLinks() {
    const viewMeta = this.getMeta()
    const alignment = this.spreadsheet.options.avExtraOptions.alignment
    if (!alignment) {
      return []
    }
    
    let sequenceIndex = this.spreadsheet.dataSet.getCellData({
      query: {
        rowIndex: viewMeta.rowIndex
      }
    }).__sequenceIndex__

    if (sequenceIndex === "$$reference$$") {
      sequenceIndex = alignment.referenceSequenceIndex
    }
    
    let __links__: { name: string, url: string }[] = []
    if (isNumber(sequenceIndex)) {
      __links__ = alignment.annotations.__links__[sequenceIndex]
    }

    return __links__
  }

  updateByState(stateName: InteractionStateName): void {
    if ((stateName === InteractionStateName.HOVER) || (stateName === InteractionStateName.HOVER_FOCUS)) {
      const __links__ = this.getLinks()
      if (__links__.length > 0) {
        if (stateName === InteractionStateName.HOVER_FOCUS) {
          this.textShape?.attr({
            fill: this.getMeta().spreadsheet.theme.dataCell?.text?.linkTextFill,
            cursor: 'pointer',
          })
          this.linkTextUnderlineShape?.set("visible", true)
          // this.stateShapes.forEach((shape: IShape) => {
          //   shape.attr("cursor", "pointer")
          // })
        } else {
          this.textShape?.attr({
            fill: this.getMeta().spreadsheet.theme.dataCell?.text?.fill,
            cursor: 'default',
          })
          this.linkTextUnderlineShape?.set("visible", false)
          // this.stateShapes.forEach((shape: IShape) => {
          //   shape.attr("cursor", "default")
          // })
        }
      }
      return
    }
    super.updateByState(stateName)
  }

  hideInteractionShape(): void {
    this.textShape?.attr({
      fill: this.getMeta().spreadsheet.theme.dataCell?.text?.fill,
      cursor: 'default',
    })
    this.linkTextUnderlineShape?.set("visible", false)
    super.hideInteractionShape()
  }

  getContextualInfo(event: GraphEvent, target: S2CellType, viewMeta: ViewMeta, iconName?: string): TContextualInfo {
    const info: TContextualInfo | undefined = super.getContextualInfo(event, target, viewMeta, iconName)
    // console.log(event, target, viewMeta)
    info.content = []
    const __links__ = this.getLinks()
    if (__links__.length > 0) {
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

  onClick(info: TAVMouseEventInfo) {
    const { iconName, event } = info
    if ((event.target.get("type") === "text") || iconName) {
      const __links__ = this.getLinks()
      if (__links__.length > 0) {
        for (const { name, url } of __links__) {
          window.open(url, "_blank")
          break
        }
      }  
    }
  }
}

