import type { MutableRefObject } from 'react'
import type { 
  SpreadSheet, ColHeaderConfig, S2MountContainer, S2DataConfig, 
  S2Options, ThemeCfg, ViewMeta, S2CellType, BaseCell, ScrollOffset,
  HeaderIconClickParams, HeaderActionIcon, CellDataParams, DataType, 
} from '@antv/s2'
import type { SheetComponentOptions } from '@antv/s2-react'
import type { IGroup, IShape, Event as GraphEvent, BBox } from '@antv/g-canvas'
import type {
  TAlignment, 
  TAlignmentSortParams, 
  TDimensions, 
  TAVColorTheme,
  TAVExtraOptions, 
  TColumnWidths,
  TAVMouseEventInfo,
  TSelectedCellsRange,
} from './types'

import { find, findIndex, countBy, debounce, isNumber, isString, isNil } from 'lodash'
import { 
  setLang, extendLocale, TableSheet, SERIES_NUMBER_FIELD, 
  TableDataSet, PALETTE_MAP, S2Event, Node as S2Node,
  InterceptType, copyToClipboard, GuiIcon, CopyMIMEType,
  CellTypes, ScrollbarPositionType, InteractionStateName,
} from '@antv/s2'
import { useMemo } from 'react'
import { readableColorIsBlack } from 'color2k'

import { SPECIAL_ROWS, RENDERER_TYPES } from './constants'
import { RENDERERS, } from './renderers'
import { ShapeBaseSupportingOffscreenCanvas } from './OffscreenCanvas'
import { svgExport, svgSort, svgSortAsc, svgSortDesc, svgPlus, svgMinus, svgFilter, svgGroup } from './icons'
import { scaleToFit, formatFieldName } from './utils'


const FOREGROUND_GROUP_MINIMAP_GROUP_Z_INDEX = 10
const KEY_FOREGROUND_GROUP_MINIMAP_GROUP = "minimapGroup"

const FOREGROUND_GROUP_SELECTION_MASK_GROUP_Z_INDEX = 11
const KEY_FOREGROUND_GROUP_SELECTION_MASK_GROUP = "selectionMaskGroup"

const locale = {
  zh_CN: {
    // test: '测试',
  },
  en_US: {
    升序: 'Asdending',
    降序: 'Descending',
    不排序: 'Do not sort',
    序号: ' ',
  },
}
extendLocale(locale)
setLang("en_US")

export class AVDataSet extends TableDataSet {
  declare spreadsheet: AVTableSheet

  public constructor(spreadsheet: AVTableSheet) {
    super(spreadsheet)
  }

  public getCellData({ query }: CellDataParams): DataType | string | number {
    if (this.displayData.length === 0 && query.rowIndex === 0) {
      return undefined
    }

    const alignment = this.spreadsheet.avStore.alignment!
    const rowData = this.displayData[query.rowIndex]
    const __sequenceIndex__ = rowData.__sequenceIndex__ as string | number
    if (query.field) {
      if (isString(__sequenceIndex__)) {
        if (__sequenceIndex__ === "$$reference$$") {
          switch (query.field) {
            case "__id__":
              return "Reference\n" + alignment.annotations[query.field]?.[alignment.referenceSequenceIndex]
            case "__sequenceIndex__":
              return __sequenceIndex__
            default:
              return alignment.annotations[query.field]?.[alignment.referenceSequenceIndex]
          }
        } else {
          return (query.field === "__id__") ? SPECIAL_ROWS[__sequenceIndex__].label : rowData[query.field]
        }
      } else {
        if (query.field === SERIES_NUMBER_FIELD) {
          return query.rowIndex + 1 - (this.spreadsheet.options.frozenRowCount ?? 0)
        } else {
          return alignment.annotations[query.field]?.[__sequenceIndex__]
        }
      }
    } else {
      return rowData
      // if (isString(__sequenceIndex__)) {
      //   if (__sequenceIndex__ === "$$reference$$") {
      //     const realData = {} as Record<string, any>
      //     for (const [k, v] of Object.entries(alignment.annotations)) {
      //       realData[k] = v[alignment.referenceSequenceIndex]
      //     }
      //     realData.__sequenceIndex__ = "$$reference$$"
      //     return realData
      //   } else {
      //     return rowData
      //   }
      // } else {
      //   const realData = {} as Record<string, any>
      //   for (const [k, v] of Object.entries(alignment.annotations)) {
      //     realData[k] = v[__sequenceIndex__]
      //   }
      //   return realData
      // }
    }
  }
}

type TClippingBounds = {
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
}

export class AVTableSheet extends TableSheet {
  public readonly id = Math.random()
  public visibleSequencePositionStart = -1
  public visibleSequencePositionEnd = -1
  // values are only valid and used in overview mode
  public visibleSequenceRowIndexStart = -1
  public visibleSequenceRowIndexEnd = -1

  public mousedownEventInfo?: TAVMouseEventInfo
  public mousemoveEventInfo?: TAVMouseEventInfo
  public mouseupEventInfo?: TAVMouseEventInfo

  protected selectionMaskGroup?: IGroup
  protected selectionMaskShape?: IShape
  protected selectionMaskLeftBorderShape?: IShape
  protected selectionMaskRightBorderShape?: IShape
  protected selectionMaskTopBorderShape?: IShape
  protected selectionMaskBottomBorderShape?: IShape

  protected isPreparingSelection = false
  protected isAnyCellSelected = false
  public selectedCellsRange: TSelectedCellsRange = {
    rowIndex: [-1, -1],
    colIndex: [-1, -1],
    sequencePosition: [-1, -1],
    sequenceRowIndex: [-1, -1]
  }

  public avStore: TAVExtraOptions
  protected minimapBackgroundShape?: IShape
  protected minimapShape?: IShape
  protected minimapViewportShape?: IShape
  protected maxScrollOffsetY = 0
  protected prevScrollY? = 0
  protected isMinimapScrolling = false
  protected minimapScrollAnchorY = 0
  // protected minimapHeight = 0
  // protected minimapRealHeight = 0
    
  protected checkContextLostTimeInterval: number = 0

  render(reloadData?: boolean, options?: { reBuildDataSet?: boolean, reBuildHiddenColumnsDetail?: boolean }) {
    console.log("render table", reloadData, options)
    super.render(reloadData, options)
  }

  constructor(dom: S2MountContainer, dataCfg: S2DataConfig, options: S2Options, initialAVStore: TAVExtraOptions) {
    super(dom, dataCfg, options)
    this.avStore = initialAVStore
    this.on(S2Event.GLOBAL_SCROLL, this.handleScrollbarScroll.bind(this))
    this.on(S2Event.GLOBAL_MOUSE_MOVE, this.handleGlobalMouseMove.bind(this))
    this.on(S2Event.GLOBAL_MOUSE_UP, this.handleGlobalMouseUp.bind(this))
    this.on(S2Event.GLOBAL_SELECTED, this.handleSelected.bind(this))
    this.on(S2Event.COL_CELL_MOUSE_DOWN, this.handleCellMouseDown.bind(this))
    this.on(S2Event.ROW_CELL_MOUSE_DOWN, this.handleCellMouseDown.bind(this))
    this.on(S2Event.DATA_CELL_MOUSE_DOWN, this.handleCellMouseDown.bind(this))
    this.on(S2Event.COL_CELL_MOUSE_MOVE, this.handleCellMouseMove.bind(this))
    this.on(S2Event.ROW_CELL_MOUSE_MOVE, this.handleCellMouseMove.bind(this))
    this.on(S2Event.DATA_CELL_MOUSE_MOVE, this.handleCellMouseMove.bind(this))
    this.on(S2Event.COL_CELL_MOUSE_UP, this.handleCellMouseUp.bind(this))
    this.on(S2Event.ROW_CELL_MOUSE_UP, this.handleCellMouseUp.bind(this))
    this.on(S2Event.DATA_CELL_MOUSE_UP, this.handleCellMouseUp.bind(this))
    this.on(S2Event.GLOBAL_KEYBOARD_DOWN, this.handleGlobalKeyboardDown.bind(this))
    
    this.interaction.addIntercepts = (interceptTypes: InterceptType[] = []) => {
      for(const interceptType of interceptTypes) {
        if ((interceptType !== InterceptType.HOVER) /*&& (interceptType !== InterceptType.CLICK)*/) {
          this.interaction.intercepts.add(interceptType)
        }
      }
    }

    const oldChangeState = this.interaction.changeState.bind(this.interaction)
    this.interaction.changeState = (interactionStateInfo) => {
      // console.log("changeState", interactionStateInfo.stateName)
      switch (interactionStateInfo.stateName) {
        case InteractionStateName.PREPARE_SELECT:
          this.isPreparingSelection = true
          break
        case InteractionStateName.SELECTED:
        case InteractionStateName.ALL_SELECTED:
        case InteractionStateName.BRUSH_SELECTED:
        // case InteractionStateName.UNSELECTED:
          // maybe unnessesary. also updated in handleSelected()
          this.isPreparingSelection = false
          break
      }

      oldChangeState(interactionStateInfo)
    }
    
    // this.checkContextLostTimeInterval = window.setInterval(() => {
    //   const canvas = this.getCanvasElement()
    //   const ctx = canvas?.getContext("2d")
    //   if (ctx) {
    //     const dpr = this.options.devicePixelRatio ?? window.devicePixelRatio
    //     if (ctx.getTransform().a !== window.devicePixelRatio) {
    //       ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    //       this.render(false)
    //     }
    //   }
    // }, 500)
  }

  updateAVStore(newAVStore: TAVExtraOptions) {
    // console.log("***update AVStore***")
    this.avStore = newAVStore
  }

  checkCanvasScaling() {
    const ctx = this.getCanvasElement().getContext("2d")
    if (!ctx) {
      return
    }

    const { a, b, c, d } = ctx.getTransform()
    const dpr = window.devicePixelRatio
    if (a * d - b * c !== dpr * dpr) {
      ctx.scale(dpr, dpr)
    }
  }

  protected buildFacet(): void {
    const ctx = this.getCanvasElement().getContext("2d")
    if (!ctx) {
      return
    }

    ctx.imageSmoothingEnabled = false
    ctx.textRendering = "optimizeSpeed"
    ctx.fontKerning = "none"

    
    // console.log("buildFacet")
    this.minimapBackgroundShape?.off("mousedown")
    this.minimapShape?.off("mousedown")
    this.minimapViewportShape?.off("mousedown")
    super.buildFacet()
  
    const showMinimap = this.avStore.showMinimap
    if (showMinimap) {
      this.renderMinimap()
    }

    this.updateSequenceCells()
    this.renderSequenceGroupDividers()
    this.renderSelectionMask()
  }

  protected handleMinimapMouseDown(event: GraphEvent) {
    this.isMinimapScrolling = true
    this.minimapScrollAnchorY = event.y - this.minimapViewportShape?.attr("y")
    if ((this.minimapScrollAnchorY < 0) || (this.minimapScrollAnchorY > this.minimapViewportShape?.attr("height"))) {
      // this.minimapScrollAnchorY = 0 // top of minimapViewport
      this.minimapScrollAnchorY = this.minimapViewportShape?.attr("height") / 2 // center of minimapViewport
    }
    this.minimapScrollTo(event.y - this.minimapScrollAnchorY)
    // console.log("mousedown", (event.y - this.minimapBackgroundShape?.attr("y")), this.minimapBackgroundShape?.attr("height"))
  }

  protected handleGlobalKeyboardDown(event: KeyboardEvent) {
    if ((event.key === "c") && (event.metaKey || event.ctrlKey)) {
      this.copySelectedContent()
    }
  }

  protected copySelectedContent() {
    if (!this.isAnyCellSelected) {
      return
    }

    const alignment = this.avStore.alignment
    if (!alignment) {
      return
    }

    const formattedValues: string[] = []
    let overview = false
    for (let i = this.selectedCellsRange.rowIndex[0]; i <= this.selectedCellsRange.rowIndex[1]; ++i) {
      const formattedRowValues = []
      for (let j = this.selectedCellsRange.colIndex[0]; j <= this.selectedCellsRange.colIndex[1]; ++j) {
        const viewMeta = this.facet.layoutResult.getCellMeta(i, j)
        const formatter = this.dataSet.getFieldFormatter(viewMeta.field!)
        if (viewMeta.valueField !== "__sequenceIndex__") {
          const formattedCellValue = formatter(viewMeta.fieldValue, viewMeta.data, viewMeta)
          formattedRowValues.push(formattedCellValue)
        } else { // viewMeta.valueField === "__sequenceIndex__"
          const sequenceIndex = viewMeta.fieldValue
          if (sequenceIndex === "$$overview$$") {
            overview = true // handle overview separately below
          } else {
            let value: string | number[]
            if (isNumber(sequenceIndex)) {
              value = alignment.sequences[sequenceIndex]
            } else {
              switch (sequenceIndex) {
                case "$$reference$$":
                  value = alignment.sequences[alignment.referenceSequenceIndex]
                  break
                case "$$consensus$$":
                  value = alignment.positionalAnnotations.consensus
                  break
                default:
                  value = ""
                  break
              }
            }
            const formattedCellValue = value.slice(
              this.selectedCellsRange.sequencePosition[0], this.selectedCellsRange.sequencePosition[1] + 1
            )
            formattedRowValues.push(formattedCellValue)
          }
        }
      }
      formattedValues.push(formattedRowValues.join("\t"))
    }

    if (overview) {
      for (let i = this.selectedCellsRange.sequenceRowIndex[0]; i <= this.selectedCellsRange.sequenceRowIndex[1]; ++i) {
        const formattedCellValue = alignment.sequences[this.avStore.sortedDisplayedIndices[i]].substring(
          this.selectedCellsRange.sequencePosition[0], this.selectedCellsRange.sequencePosition[1] + 1
        )
        formattedValues.push(formattedCellValue)
      }
    }

    const content = formattedValues.join("\n")
    copyToClipboard({ type: CopyMIMEType.PLAIN, content})
  }
  
  protected handleGlobalMouseMove(event: MouseEvent) {
    if (this.isMinimapScrolling) {
      this.minimapScrollTo(event.offsetY - this.minimapScrollAnchorY)
    }
  }

  protected handleGlobalMouseUp() {
    if (this.isMinimapScrolling) {
      this.isMinimapScrolling = false
      this.minimapScrollAnchorY = 0
    }
  }

  getMouseEventInfo(event: GraphEvent): TAVMouseEventInfo {
    let target = this.getCell(event.target)
    let viewMeta = target?.getMeta()
    let iconName: string | undefined
    if (target instanceof GuiIcon) {
      iconName = target.cfg.name
      target = target.cfg.parent
      viewMeta = target.getMeta()
    }

    return {
      event, 
      target, 
      viewMeta, 
      iconName, 
      normalizedPosition: target.getNormalizedPosition(event, target, viewMeta),
      contextualInfo: undefined,
    }
  }

  protected handleCellMouseDown(event: GraphEvent) {
    const { button, altKey, ctrlKey, shiftKey } = event.originalEvent as MouseEvent
    if ((button === 0) && !altKey && !ctrlKey && !shiftKey) {
      this.resetSelectedCellsRange()
      this.mousedownEventInfo = this.getMouseEventInfo(event)
      this.mousemoveEventInfo = this.mousedownEventInfo
    }
  }

  protected handleCellMouseMove(event: GraphEvent) {
    this.mousemoveEventInfo = this.getMouseEventInfo(event)

    if (this.isPreparingSelection) {
      this.renderSelectionMask()
    }
  }

  protected handleCellMouseUp(event: GraphEvent) {
    this.mouseupEventInfo = this.getMouseEventInfo(event)
  }

  resetSelectedCellsRange() {
    this.isAnyCellSelected = false
    this.selectedCellsRange.rowIndex[0] = -1
    this.selectedCellsRange.rowIndex[1] = -1
    this.selectedCellsRange.colIndex[0] = -1
    this.selectedCellsRange.colIndex[1] = -1
    this.selectedCellsRange.sequenceRowIndex[0] = -1
    this.selectedCellsRange.sequenceRowIndex[1] = -1
    this.selectedCellsRange.sequencePosition[0] = -1
    this.selectedCellsRange.sequencePosition[1] = -1
  }
  
  isCellSelected(cell: S2CellType) {
    if (!this.isAnyCellSelected || (cell.cellType !== CellTypes.DATA_CELL)) {
      return false
    }

    const { rowIndex, colIndex } = cell.getMeta()
    return (
      (colIndex >= this.selectedCellsRange.colIndex[0]) &&
      (colIndex <= this.selectedCellsRange.colIndex[1]) &&
      (rowIndex >= this.selectedCellsRange.rowIndex[0]) &&
      (rowIndex <= this.selectedCellsRange.rowIndex[1])
    )
  }

  public _setRange(
    out: number[],
    in1: number,
    in2: number,
    defaultLowest: number,
    defaultHighest: number,
  ) {
    if ((in1 < 0) && (in2 < 0)) {
      out[0] = defaultLowest
      out[1] = defaultHighest
    } else if (in1 < 0) {
      out[0] = defaultLowest
      out[1] = in2
    } else if (in2 < 0) {
      out[0] = defaultLowest
      out[1] = in1
    } else {
      out[0] = (in1 < in2) ? in1 : in2
      out[1] = (in1 < in2) ? in2 : in1
    }

  }

  protected updateSelectedCellsRange() {
    if (!this.mousedownEventInfo || !this.mousemoveEventInfo) {
      this.resetSelectedCellsRange()
      return
    }

    const down = this.mousedownEventInfo.normalizedPosition
    const up = this.mousemoveEventInfo.normalizedPosition

    const { start: lowestRowIndex, end: highestRowIndex } = this.facet.getCellRange()
    this._setRange(this.selectedCellsRange.rowIndex, down.rowIndex, up.rowIndex, lowestRowIndex, highestRowIndex)

    let lowestColIndex = 0
    let highestColIndex = 0
    for (const node of this.facet.layoutResult.colLeafNodes) {
      if (node.field === SERIES_NUMBER_FIELD) {
        lowestColIndex = 1
      }

      if (node.field === "__sequenceIndex__") {
        // assuming "__sequenceIndex__" is the last selectable column
        highestColIndex = node.colIndex
      }
    }
    this._setRange(this.selectedCellsRange.colIndex, down.colIndex, up.colIndex, lowestColIndex, highestColIndex)

    if (this.facet.layoutResult.getCellMeta(this.selectedCellsRange.rowIndex[1], this.selectedCellsRange.colIndex[1]).fieldValue === "$$overview$$") {
      const lowestSequenceRowIndex = 0
      const highestSequenceRowIndex = this.facet.getCellRange().end - (this.options.frozenRowCount ?? 0)
      this._setRange(this.selectedCellsRange.sequenceRowIndex, down.sequenceRowIndex, up.sequenceRowIndex, lowestSequenceRowIndex, highestSequenceRowIndex)
    } else {
      this.selectedCellsRange.sequenceRowIndex[0] = -1
      this.selectedCellsRange.sequenceRowIndex[1] = -1
    }

    if (this.facet.layoutResult.colLeafNodes[this.selectedCellsRange.colIndex[1]].field === "__sequenceIndex__") {
      const lowestSequencePosition = 0
      const highestSequencePosition = this.avStore.alignment ? this.avStore.alignment.length - 1 : 0
      this._setRange(this.selectedCellsRange.sequencePosition, down.sequencePosition, up.sequencePosition, lowestSequencePosition, highestSequencePosition)
    } else {
      this.selectedCellsRange.sequencePosition[0] = -1
      this.selectedCellsRange.sequencePosition[1] = -1
    }
  }
  
  protected handleSelected(cells: S2CellType[]) {
    this.isPreparingSelection = false

    if ((cells.length === 0) || !this.mousedownEventInfo || !this.mousemoveEventInfo) {
      this.isAnyCellSelected = false
      this.resetSelectedCellsRange()
    } else {
      this.isAnyCellSelected = true
      this.updateSelectedCellsRange()
    }

    this.renderSelectionMask()
    console.log("selected", cells.length, cells[0]?.cellType, this.interaction.getAllCells().length)
  }

  protected _cellBorderY(rowIndex: number, sequenceRowIndex: number, border: "top" | "bottom", bounds: TClippingBounds): [number, boolean] {
    let y = 0, isVisible = true

    if (this.dataSet.getCellData({query: {rowIndex, field: "__sequenceIndex__"}}) as unknown as string === "$$overview$$") {
      y = Math.round(this.facet.viewCellHeights.getCellOffsetY(rowIndex)) + sequenceRowIndex * this.avStore.dimensions.rowHeight
      if (border === "bottom") {
        y += this.avStore.dimensions.rowHeight
      }
    } else {
      y = Math.round(this.facet.viewCellHeights.getCellOffsetY((border === "top") ? rowIndex : rowIndex + 1))
    }
    
    if (rowIndex >= this.options.frozenRowCount!) {
      const { scrollY = 0 } = this.facet.getScrollOffset()
      y -= scrollY

      if (y < bounds.minY) {
        isVisible = false
        y = bounds.minY
      } else if (y > bounds.maxY) {
        isVisible = false
        y = bounds.maxY
      }
    }

    return [y, isVisible]
  }

  protected _cellBorderX(colIndex: number, sequencePosition: number, border: "left" | "right", bounds: TClippingBounds): [number, boolean] {
    let x = 0, isVisible = true
    const colLeafNodes = this.facet.layoutResult.colLeafNodes

    if (colLeafNodes[colIndex].field === "__sequenceIndex__") {
      x = Math.round(this.facet.viewCellWidths[colIndex]) + sequencePosition * this.avStore.dimensions.residueWidth
      if (border === "right") {
        x += this.avStore.dimensions.residueWidth
      }
    } else {
      x = Math.round(this.facet.viewCellWidths[(border === "left") ? colIndex : colIndex + 1])
    }
    
    if (colIndex >= this.options.frozenColCount!) {
      const { scrollX = 0 } = this.facet.getScrollOffset()
      x -= scrollX

      if (x < bounds.minX) {
        isVisible = false
        x = bounds.minX
      } else if (x > bounds.maxX) {
        isVisible = false
        x = bounds.maxX
      }
    }

    return [x, isVisible]
  }

  renderSelectionMask() {
    if (!this.isAnyCellSelected && !this.isPreparingSelection) {
      if (this.selectionMaskGroup?.get("visible")) {
        this.selectionMaskGroup?.set("visible", false)
      }
      return
    }

    if (this.isPreparingSelection) {
      this.updateSelectedCellsRange()
    }

    const colLeafNodes = this.facet.layoutResult.colLeafNodes
    const yOffset = this.facet.cornerBBox.height

    const frozenTrailingColCount = this.options.frozenTrailingColCount ?? 0
    const bounds: TClippingBounds = {
      minX: this.facet.viewCellWidths[this.options.frozenColCount ?? 0],
      maxX: frozenTrailingColCount ? colLeafNodes[colLeafNodes.length - frozenTrailingColCount].x : 0,
      minY: this.facet.viewCellHeights.getCellOffsetY(this.options.frozenRowCount!),
      maxY: this.facet.getCanvasHW().height - this.avStore.scrollbarSize - yOffset
    }

    let [x1, isLeftBorderVisible] = this._cellBorderX(
      this.selectedCellsRange.colIndex[0], 
      this.selectedCellsRange.sequencePosition[0], 
      "left",
      bounds
    )

    let [x2, isRightBorderVisible] = this._cellBorderX(
      this.selectedCellsRange.colIndex[1], 
      this.selectedCellsRange.sequencePosition[1], 
      "right",
      bounds
    )

    let [y1, isTopBorderVisible] = this._cellBorderY(
      this.selectedCellsRange.rowIndex[0], 
      this.selectedCellsRange.sequenceRowIndex[0], 
      "top",
      bounds
    )
    y1 += yOffset

    let [y2, isBottomBorderVisible] = this._cellBorderY(
      this.selectedCellsRange.rowIndex[1], 
      this.selectedCellsRange.sequenceRowIndex[1], 
      "bottom",
      bounds
    )
    y2 += yOffset
    
    const theme = this.isPreparingSelection 
      ? this.theme.dataCell?.cell?.interactionState?.prepareSelect 
      : this.theme.dataCell?.cell?.interactionState?.selected
    const halfBorderWidth = (theme?.borderWidth ?? 2) / 2

    const maskAttrs = {
      x: x1,
      y: y1,// + yOffset,
      width: x2 - x1,
      height: y2 - y1,
      fill: theme?.backgroundColor,
      fillOpacity: theme?.backgroundOpacity,
    }

    const leftBorderAttrs = {
      x1: x1 + halfBorderWidth,
      y1: y1,
      x2: x1 + halfBorderWidth,
      y2: y2,
      stroke: theme?.borderColor,
      strokeOpacity: theme?.borderOpacity,
      lineWidth: theme?.borderWidth
    }

    const rightBorderAttrs = {
      x1: x2 - halfBorderWidth,
      y1: y1,
      x2: x2 - halfBorderWidth,
      y2: y2,
      stroke: theme?.borderColor,
      strokeOpacity: theme?.borderOpacity,
      lineWidth: theme?.borderWidth
    }

    const topBorderAttrs = {
      x1: x1,
      y1: y1 + halfBorderWidth,
      x2: x2,
      y2: y1 + halfBorderWidth,
      stroke: theme?.borderColor,
      strokeOpacity: theme?.borderOpacity,
      lineWidth: theme?.borderWidth
    }

    const bottomBorderAttrs = {
      x1: x1,
      y1: y2 - halfBorderWidth,
      x2: x2,
      y2: y2 - halfBorderWidth,
      stroke: theme?.borderColor,
      strokeOpacity: theme?.borderOpacity,
      lineWidth: theme?.borderWidth
    }

    if ((x1 === x2) || (y1 === y2)) {
      isTopBorderVisible = isBottomBorderVisible = isLeftBorderVisible = isRightBorderVisible = false
    }

    if (this.selectionMaskGroup) {
      if (!this.foregroundGroup.contain(this.selectionMaskGroup)) {
        this.foregroundGroup.removeChild(this.selectionMaskGroup, true)
        this.selectionMaskGroup = undefined
      }
    }
    
    if (!this.selectionMaskGroup) {
      this.selectionMaskGroup = this.foregroundGroup.addGroup({
        id: KEY_FOREGROUND_GROUP_SELECTION_MASK_GROUP,
        zIndex: FOREGROUND_GROUP_SELECTION_MASK_GROUP_Z_INDEX,
      })

      this.selectionMaskShape = this.selectionMaskGroup.addShape("rect", { 
        attrs: maskAttrs, 
        visible: true, 
        capture: false 
      })
      
      this.selectionMaskLeftBorderShape = this.selectionMaskGroup.addShape("line", { 
        attrs: leftBorderAttrs, 
        visible: isLeftBorderVisible, 
        capture: false 
      })

      this.selectionMaskRightBorderShape = this.selectionMaskGroup.addShape("line", { 
        attrs: rightBorderAttrs, 
        visible: isRightBorderVisible, 
        capture: false 
      })

      this.selectionMaskTopBorderShape = this.selectionMaskGroup.addShape("line", { 
        attrs: topBorderAttrs, 
        visible: isTopBorderVisible, 
        capture: false 
      })

      this.selectionMaskBottomBorderShape = this.selectionMaskGroup.addShape("line", { 
        attrs: bottomBorderAttrs, 
        visible: isBottomBorderVisible, 
        capture: false 
      })
    } else {
      this.selectionMaskGroup.set("visible", true)    
      this.selectionMaskShape!.attr(maskAttrs)
      this.selectionMaskLeftBorderShape!.attr(leftBorderAttrs)
      this.selectionMaskLeftBorderShape!.set("visible", isLeftBorderVisible)
      this.selectionMaskRightBorderShape!.attr(rightBorderAttrs)
      this.selectionMaskRightBorderShape!.set("visible", isRightBorderVisible)
      this.selectionMaskTopBorderShape!.attr(topBorderAttrs)
      this.selectionMaskTopBorderShape!.set("visible", isTopBorderVisible)
      this.selectionMaskBottomBorderShape!.attr(bottomBorderAttrs)
      this.selectionMaskBottomBorderShape!.set("visible", isBottomBorderVisible)
    }
  }

  protected minimapScrollTo(y: number) {
    let maxMinimapOffsetY = this.minimapShape?.attr("height") - this.minimapViewportShape?.attr("height")
    if (maxMinimapOffsetY < 0) {
      maxMinimapOffsetY = 0
    }

    let minimapOffsetY = y - this.minimapShape?.attr("y")
    if (minimapOffsetY < 0) {
      minimapOffsetY = 0
    } else if (minimapOffsetY > maxMinimapOffsetY) {
      minimapOffsetY = maxMinimapOffsetY
    }

    this.updateScrollOffset({
      offsetX: {
        value: this.facet.getScrollOffset().scrollX,
        animate: false,
      },
      offsetY: {
        value: (maxMinimapOffsetY === 0) ? 0 : this.maxScrollOffsetY * minimapOffsetY / maxMinimapOffsetY,
        animate: false,
      },
    })
  }

  protected handleScrollbarScroll(position: ScrollOffset) {
    this.checkCanvasScaling()
    this.updateSequenceCells()
    this.renderSequenceGroupDividers()
    if (this.isPreparingSelection || this.isAnyCellSelected) {
      this.renderSelectionMask()
    }

    let scrollY = position.scrollY ?? 0
    if (scrollY > this.maxScrollOffsetY) {
      scrollY = this.maxScrollOffsetY
    }

    if (scrollY !== this.prevScrollY) {
      const { y: minimapY, height: minimapHeight } = this.minimapShape?.attr() ?? {}
      const minimapViewportHeight = this.minimapViewportShape?.attr("height")
      let minimapViewportY: number
      if (this.maxScrollOffsetY === 0) {
        minimapViewportY = minimapY
      } else {
        minimapViewportY = minimapY + (minimapHeight - minimapViewportHeight) * scrollY / this.maxScrollOffsetY
      }
      this.minimapViewportShape?.attr('y', minimapViewportY)
    }
    this.prevScrollY = scrollY
  }

  protected updateSequenceCells(): void {
    // console.log("new dynamicRenderCell")
    const alignment = this.avStore.alignment
    if (!alignment) {
      return
    }

    const isOverviewMode = this.avStore.isOverviewMode
    const dimensions = this.avStore.dimensions
    if (!dimensions) {
      return
    }
    
    const { scrollX = 0, scrollY = 0 } = this.facet.getScrollOffset()
    const { x: sequenceCellX, y: sequenceCellY } = find(this.facet.layoutResult.colLeafNodes, { field: "__sequenceIndex__" }) as S2Node
    const { x: clipX, y: clipY, width: clipWidth, height: clipHeight } = this.panelScrollGroup.getClip().getBBox()

    const right = clipX + clipWidth - scrollX
    for (const shape of (this.foregroundGroup.findById("frozenSplitLine") as IGroup).getChildren()) {
      if (shape.get("type") === "line") {
        if (shape.attr("x2") > right) {
          shape.attr("x2", right)
        }
      } else if (shape.get("type") === "rect") {
        const shapeRight = shape.attr("x") + shape.attr("width")
        if (shapeRight > right) {
          shape.attr("width", shape.attr("width") - (shapeRight - right))
        }
      }
    }

    if (clipX + clipWidth <= sequenceCellX) {
      return
    }

    const { residueWidth, residueHeight } = dimensions
    if (clipX + clipWidth < sequenceCellX) { // sequence column not visible
      this.visibleSequencePositionStart = -1
      this.visibleSequencePositionEnd = -1
    } else {
      this.visibleSequencePositionStart = Math.floor((clipX - sequenceCellX) / residueWidth)
      if (this.visibleSequencePositionStart < 0) {
        this.visibleSequencePositionStart = 0
      }

      this.visibleSequencePositionEnd = Math.ceil((clipX + clipWidth - sequenceCellX) / residueWidth)
      if (this.visibleSequencePositionEnd >= alignment.length) {
        this.visibleSequencePositionEnd = alignment.length - 1
      }
    }
    
    if (this.visibleSequencePositionStart < 0) {
      return
    }

    if (isOverviewMode) {
      this.visibleSequenceRowIndexStart = Math.floor(scrollY / residueHeight)
      if (this.visibleSequenceRowIndexStart < 0) {
        this.visibleSequenceRowIndexStart = 0
      }

      this.visibleSequenceRowIndexEnd = Math.ceil((scrollY + clipHeight) / residueHeight)
      if (this.visibleSequenceRowIndexEnd >= alignment.depth) {
        this.visibleSequenceRowIndexEnd = alignment.depth - 1
      }
    } else {
      this.visibleSequenceRowIndexStart = -1
      this.visibleSequenceRowIndexEnd = -1
      // ({start: this.visibleSequenceIndexStart, end: this.visibleSequenceIndexEnd} = this.facet.viewCellHeights.getIndexRange(clipY, clipY + clipHeight - 1))
      // this.visibleSequenceIndexStart -= firstSequenceRowIndex
      // this.visibleSequenceIndexEnd -= firstSequenceRowIndex
    }

    // console.log("afterDynamicRenderCell", "__sequenceIndex__", this.visibleSequencePositionStart, this.visibleSequencePositionEnd)
    // console.log(this.panelGroup.getChildren())
    for (const cell of this.interaction.getAllCells()) {
      const viewMeta = cell.getMeta()
      if ((viewMeta.valueField === "__sequenceIndex__") || (viewMeta.field === "__sequenceIndex__")) {
        // cell.drawBackgroundShape()
        // cell.drawTextShape()
        cell.drawContent()
      }
    }
  }

  renderMinimap() {
    // console.log("render minimap")
    const minimapImage = this.avStore.minimapImage
    if (!minimapImage) {
      return
    }

    const dimensions = this.avStore.dimensions
    if (!dimensions) {
      return
    }

    const {
      y: panelGroupY, 
      height: panelGroupHeight
    } = this.panelGroup.getClip().getBBox()
    
    // console.log('render minimap')
    const minimapGroup = this.foregroundGroup.addGroup({
      id: KEY_FOREGROUND_GROUP_MINIMAP_GROUP,
      zIndex: FOREGROUND_GROUP_MINIMAP_GROUP_Z_INDEX,
    })
    minimapGroup.getShapeBase = () => {
      return ShapeBaseSupportingOffscreenCanvas
    }

    const scrollbarSize = this.avStore.scrollbarSize
    const minimapColNode = this.facet.layoutResult.colLeafNodes.find((node) => node.field === "$$minimap$$") as S2Node
    const minimapBackgroundWidth = minimapColNode.width - scrollbarSize
    const minimapBackgroundHeight = panelGroupHeight
    const minimapBackgroundX = minimapColNode.x
    const minimapBackgroundY = panelGroupY
    this.minimapBackgroundShape = minimapGroup.addShape('rect', {
      zIndex: 1,
      attrs: {
        x: minimapBackgroundX, 
        y: minimapBackgroundY,
        width: minimapBackgroundWidth, 
        height: minimapBackgroundHeight, 
        fill: this.theme.background?.color,
      }
    })

    const minimapMaxWidth = minimapBackgroundWidth - 2 * dimensions.minimapMargin
    const minimapMaxHeight = minimapBackgroundHeight
    const [minimapWidth, minimapHeight] = scaleToFit(minimapImage.width, minimapImage.height, minimapMaxWidth, minimapMaxHeight)
    const minimapX = minimapBackgroundX + (minimapBackgroundWidth - minimapWidth) / 2 // + minimapMargin,
    const minimapY = minimapBackgroundY
    this.minimapShape = minimapGroup.addShape('offscreenCanvas', {
      zIndex: 2, 
      attrs: {
        x: minimapX,
        y: minimapY,
        width: minimapWidth,
        height: minimapHeight,
        img: minimapImage,
        sx: 0,
        sy: 0,
        sWidth: minimapImage.width,
        sHeight: minimapImage.height,
        dx: minimapX,
        dy: minimapY,
        dWidth: minimapWidth,
        dHeight: minimapHeight,
        imageSmoothingEnabled: false,
      }
    })

    let minimapViewportX = minimapBackgroundX + dimensions.minimapMargin
    if (minimapViewportX > minimapX) {
      minimapViewportX = minimapX
    }
    const minimapViewportWidth = minimapBackgroundWidth - 2 * (minimapViewportX - minimapBackgroundX)

    const { height: frozenRowGroupHeight } = this.frozenRowGroup.getClip().getBBox()
    const scrollableHeight = this.facet.getRealHeight() - frozenRowGroupHeight // total height that's scrollable
    const { height: panelScrollGroupHeight } = this.panelScrollGroup.getClip().getBBox()
    this.maxScrollOffsetY = scrollableHeight - panelScrollGroupHeight
    if (this.maxScrollOffsetY < 0) {
      this.maxScrollOffsetY = 0
    }

    const minimapViewportHeight = minimapHeight * panelScrollGroupHeight / scrollableHeight
    let { scrollY = 0} = this.facet.getScrollOffset()
    if (scrollY > this.maxScrollOffsetY) {
      scrollY = this.maxScrollOffsetY
    }

    let minimapViewportY: number
    if (this.maxScrollOffsetY === 0) {
      minimapViewportY = minimapY
    } else {
      minimapViewportY = minimapY + (minimapHeight - minimapViewportHeight) * scrollY / this.maxScrollOffsetY
    }

    this.minimapViewportShape = minimapGroup.addShape('rect', {
      zIndex: 1,
      attrs: {
        x: minimapViewportX,
        y: minimapViewportY,
        width: minimapViewportWidth,
        height: minimapViewportHeight, 
        stroke: this.theme.dataCell?.text?.fill, // this.theme.splitLine?.verticalBorderColor, 
      }
    })

    this.minimapBackgroundShape.on("mousedown", this.handleMinimapMouseDown.bind(this))
    this.minimapShape.on("mousedown", this.handleMinimapMouseDown.bind(this))
    this.minimapViewportShape.on("mousedown", this.handleMinimapMouseDown.bind(this))
  }

  renderSequenceGroupDividers() {
    const isOverviewMode = this.avStore.isOverviewMode
    if (isOverviewMode) {
      return
    }

    const alignment = this.avStore.alignment
    if (alignment?.groupBy === undefined) {
      return
    }


    const gridGroup = this.panelScrollGroup.findById("gridGroup") as IGroup
    const frozenColGroup = this.frozenColGroup.findById("frozenColGroup") as IGroup
    for (const group of [ gridGroup, frozenColGroup ]) {
      for (const line of group.getChildren()) {
        if (line.attr("lineWidth") === 0) {
          line.set("visible", false)
        }
      }  
    }

    const seriesColNode = this.facet.layoutResult.colLeafNodes.find((node) => node.field === SERIES_NUMBER_FIELD) as S2Node
    const sortedDisplayedIndices = this.avStore.sortedDisplayedIndices
    const firstSequenceRowIndex = this.avStore.firstSequenceRowIndex
    const collapsedGroups = this.avStore.collapsedGroups
    let { minX: panelScrollGroupMinX, maxX: panelScrollGroupMaxX } = this.panelScrollGroup.getBBox()
    let { minX: frozenColGroupMinX, maxX: frozenColGroupMaxX } = this.frozenColGroup.getBBox()
    let [ colMin, colMax, rowMin = 0, rowMax = 0 ] = this.facet.preCellIndexes.center
    for (let rowIndex = rowMin + 1; rowIndex <= rowMax; ++rowIndex) {
      const groupIndex = alignment.annotations.__groupIndex__[sortedDisplayedIndices[rowIndex - firstSequenceRowIndex]]
      if (collapsedGroups.includes(groupIndex)) {
        continue
      }

      const prevRowGroupIndex = alignment.annotations.__groupIndex__[sortedDisplayedIndices[rowIndex - 1 - firstSequenceRowIndex]]
      if (collapsedGroups.includes(prevRowGroupIndex)) {
        continue
      }
      
      if (groupIndex === prevRowGroupIndex) {
        continue
      }

      const y = this.facet.viewCellHeights.getCellOffsetY(rowIndex)
      const stroke = this.theme.dataCell?.text?.fill // this.theme.splitLine?.horizontalBorderColor ?? ""
      const lineWidth = 2 // this.theme.splitLine?.horizontalBorderWidth ?? 1
      gridGroup.addShape('line', {
        attrs: {
          x1: panelScrollGroupMinX,
          y1: y,
          x2: panelScrollGroupMaxX,
          y2: y,
          lineWidth,
          stroke,
        }
      })    
      
      frozenColGroup.addShape('line', {
        attrs: {
          x1: seriesColNode.x + seriesColNode.width,
          y1: y,
          x2: frozenColGroupMaxX,
          y2: y,
          lineWidth,
          stroke,
        }
      })    
    }
  }

  // Override parent class's to add support for multi-line text
  public measureTextWidth = (text: number | string = '', font: unknown): number => {
    let maxLineWidth = 0
    for (const line of `${text}`.split("\n")) {
      const textMetrics = this.measureText(line, font)
      const lineWidth = textMetrics.width
      if (lineWidth > maxLineWidth) {
        maxLineWidth = lineWidth
      }
    }
    
    return maxLineWidth
  }

  public measureTextWidthRoughly = (text: any, font: any = {}): number => {
    let longest = 0
    let length = 0
    for (const char of text) {
      if ((char === "\n") || (char === "\r")) {
        if (length > longest) {
          longest = length
        }
        length = 0
      } else {
        ++length
      }
    }

    return (length > longest) ? length : longest
  }
}

function getHeaderActionIcons(
  columns: string[],
  sortBy: TAlignmentSortParams[],
  groupBy: string | number | undefined,
  onColHeaderActionIconClick: (props: HeaderIconClickParams) => void,
): HeaderActionIcon[] {
  const ascendingColumns: string[] = []
  const descendingColumns: string[] = []
  const otherSortableColumns: string[] = []
  const unsortableColumns = [SERIES_NUMBER_FIELD, "__sequenceIndex__", "$$minimap$$"]
  for (const by of sortBy) {
    if (by.order === 'asc') {
      ascendingColumns.push(by.field)
    } else {
      descendingColumns.push(by.field)
    }
  }

  for (const c of columns) {
    if (ascendingColumns.includes(c) || descendingColumns.includes(c) || unsortableColumns.includes(c)) {
      continue
    }
    otherSortableColumns.push(c)
  }

  const headerActionIcons: HeaderActionIcon[] = [{
    iconNames: ["Group", "Filter", "Sort", "SortAsc", "SortDesc"],
    belongsCell: 'colCell',
    // defaultHide: true,
    displayCondition: (node: S2Node, iconName: string) => {
      switch(iconName) {
        case "Group":
          return node.field === groupBy
        case "SortAsc":
          return ascendingColumns.includes(node.field)
        case "SortDesc":
          return descendingColumns.includes(node.field)
        case "Sort":
          return otherSortableColumns.includes(node.field)
        case "Filter":
          // return !unsortableColumns.includes(node.field)
          return false
      }
      return false
    },
    onClick: onColHeaderActionIconClick
  }]

  return headerActionIcons
}

const useLayoutCoordinate = (
  columnWidthsRef: MutableRefObject<TColumnWidths>,
  alignment: TAlignment | null,
  dimensions: TDimensions, 
  headerActionIcons: HeaderActionIcon[],
  scrollbarSize: number,
  showMinimap: boolean, 
) => useMemo(() => (spreadsheet: SpreadSheet, rowNode: S2Node, colNode: S2Node) => {
  if (!colNode || (columnWidthsRef.current.isResizing === colNode.field)) {
    return
  }

  if (colNode.field === "$$minimap$$") {
    if (showMinimap && alignment?.length && alignment?.depth) {
      if (spreadsheet.options.height) {
        const maxMinimapHeight = spreadsheet.options.height - dimensions.colHeight
        // const dpr = window.devicePixelRatio
        // const maxMinimapHeight = spreadsheet.getCanvasElement().height / dpr - dimensions.colHeight
        colNode.width = scaleToFit(
          alignment.length, alignment.depth, dimensions.maxMinimapWidth, maxMinimapHeight
        )[0] + scrollbarSize + 2 * dimensions.minimapMargin  
      }
    } else {
      colNode.width = scrollbarSize
    }
    return 
  }

  if (colNode.field === "__sequenceIndex__") {
    if (alignment?.length) {
      colNode.width = dimensions.residueWidth * alignment.length // + scrollbarSize, // + dimensions.paddingLeft + dimensions.paddingRight
    }
    return
  }

  const colWidth = columnWidthsRef.current.fieldWidths[colNode.field]
  if (
    (colWidth !== undefined) && 
    (alignment?.uuid === columnWidthsRef.current.alignmentUuid) &&
    (dimensions.zoom === columnWidthsRef.current.zoom) &&
    (![SERIES_NUMBER_FIELD, alignment?.groupBy].includes(colNode.field) || (columnWidthsRef.current.isGrouped === !!alignment?.groupBy))
  ) {
    colNode.width = colWidth
    return
  }

  const dataSet = spreadsheet.dataSet
  const formatter = dataSet.getFieldFormatter(colNode.field)
  let longestCellData: string = ""
  let longestCellDataRoughWidth = 0
  for (let rowIndex = 0; rowIndex < dataSet.getDisplayDataSet().length; ++rowIndex) {
    let cellData = dataSet.getCellData({query: {rowIndex, field: colNode.field}})
    if (formatter) {
      cellData = formatter(cellData)
    }
    cellData = isNil(cellData) ? "" : `${cellData}`
    const roughWidth = spreadsheet.measureTextWidthRoughly(cellData)
    if (roughWidth > longestCellDataRoughWidth) {
      longestCellData = cellData
      longestCellDataRoughWidth = roughWidth
    }
  }

  const {left: cellPaddingLeft = 0, right: cellPaddingRight = 0} = spreadsheet.theme.dataCell?.cell?.padding ?? {}
  const EXTRA_PIXEL = 1
  colNode.width = Math.min(200, Math.max(
    spreadsheet.measureTextWidth(longestCellData, spreadsheet.theme.dataCell?.text), 
    spreadsheet.measureTextWidth(colNode.label, spreadsheet.theme.colCell?.bolderText)
  )) + cellPaddingLeft + cellPaddingRight + EXTRA_PIXEL

  let iconCount = 0
  for (const iconName of headerActionIcons[0].iconNames) {
    if (headerActionIcons[0].displayCondition?.(colNode, iconName)) {
      ++iconCount
    }
  }

  if ((colNode.field === SERIES_NUMBER_FIELD) && (alignment?.groupBy)) {
    ++iconCount
  }

  if (iconCount > 0) {
    const { iconSize, iconMarginLeft, iconMarginRight } = dimensions
    colNode.width += (iconSize + iconMarginLeft + iconMarginRight) * iconCount - iconMarginRight
  }
}, [
  columnWidthsRef,
  alignment?.uuid,
  alignment?.depth,
  alignment?.groupBy,
  alignment?.length,
  dimensions, 
  headerActionIcons,
  scrollbarSize,
  showMinimap 
])

function colCell(node: S2Node, spreadsheet: SpreadSheet, headerConfig: ColHeaderConfig) {
  let renderer: RENDERER_TYPES
  switch (node.field) {
    case SERIES_NUMBER_FIELD:
      renderer = RENDERER_TYPES.COL_SEQUENCE_SERIES
      break
    case "__sequenceIndex__":
      renderer = RENDERER_TYPES.COL_SEQUENCE
      break
    case "$$minimap$$":
      renderer = RENDERER_TYPES.COL_MINIMAP
      break
    default:
      renderer = RENDERER_TYPES.COL_TEXT
  }

  return new RENDERERS[renderer](node, spreadsheet, headerConfig)
}

const useDataCell = (
  isCollapsedGroupAtRowIndex: boolean[]
) => useMemo(() => (viewMeta: ViewMeta) => {
  let renderer: RENDERER_TYPES
  let sequenceIndex: number | string
  if (viewMeta.valueField === "__sequenceIndex__") {
    sequenceIndex = viewMeta.fieldValue as string | number
    if (isNumber(sequenceIndex)) {
      renderer = isCollapsedGroupAtRowIndex[viewMeta.rowIndex] ? RENDERER_TYPES.SEUENCE_LOGO : RENDERER_TYPES.SEQUENCE
      // renderer = RENDERER_TYPES.SEQUENCE
      // if (alignment?.groupBy) {
      //   const groupIndex = alignment.annotations.__groupIndex__[sequenceIndex]
      //   if (collapsedGroups.includes(groupIndex)) {
      //     renderer = RENDERER_TYPES.SEUENCE_LOGO
      //   }
      // }
    } else {
      renderer = SPECIAL_ROWS[sequenceIndex as keyof typeof SPECIAL_ROWS]?.renderer ?? RENDERER_TYPES.SEQUENCE
    }
  } else if (viewMeta.valueField === SERIES_NUMBER_FIELD) {
    renderer = RENDERER_TYPES.SEQUENCE_SERIES
  } else if (viewMeta.valueField === "$$minimap$$") {
    renderer = RENDERER_TYPES.MINIMAP_DUMMY
  } else if (viewMeta.valueField === "__id__") {
    renderer = RENDERER_TYPES.SEQUENCE_ID
  } else {
    renderer = RENDERER_TYPES.TEXT
    const spreadsheet = viewMeta.spreadsheet as AVTableSheet
    const alignment = spreadsheet.avStore.alignment
    if (alignment) {
      try {
        const { number, string } = alignment.annotationFields[viewMeta.valueField]
        if (number > string) {
          // console.log(viewMeta.valueField, alignment.annotationFields[viewMeta.valueField])
          renderer = RENDERER_TYPES.NUMBER
        }
      } catch (e) {
        // console.log("useDataCell", viewMeta.spreadsheet.avStore.alignment?.name, viewMeta.valueField)
        console.log("useDataCell", viewMeta.spreadsheet.avStore.alignment?.name, viewMeta.valueField, viewMeta.spreadsheet.dataCfg.fields.columns)
        throw(e)
      }
    }
  }
  
  return new RENDERERS[renderer](viewMeta, viewMeta?.spreadsheet)
}, [
  isCollapsedGroupAtRowIndex,
])

export function useS2Options(
  alignment: TAlignment | undefined,
  columns: string[],
  columnWidthsRef: MutableRefObject<TColumnWidths>,
  pinnedColumnsCount: number,
  sortBy: TAlignmentSortParams[],
  isCollapsedGroupAtRowIndex: boolean[],
  isOverviewMode: boolean,
  devicePixelRatio: number,
  dimensions: TDimensions, 
  scrollbarSize: number,
  showMinimap: boolean, 
  rowHeightsByField: Record<string, number>, 
  highlightCurrentSequence: boolean, 
  onColHeaderActionIconClick: (props: HeaderIconClickParams) => void,
): SheetComponentOptions {
  console.log("useS2Options", alignment?.name, columns)
  const headerActionIcons = useMemo(() => (
    getHeaderActionIcons(columns, sortBy, alignment?.groupBy, onColHeaderActionIconClick)
  ), [columns,sortBy, alignment?.groupBy, onColHeaderActionIconClick])

  const layoutCoordinate = useLayoutCoordinate(
    columnWidthsRef, alignment, dimensions, headerActionIcons, scrollbarSize, showMinimap
  )

  const dataCell = useDataCell(isCollapsedGroupAtRowIndex)

  return useMemo(() => {
    let defaultRowHeight: number
    if (isOverviewMode) {
      // overview mode: entire alignment in one cell
      if (alignment?.depth) {
        defaultRowHeight = dimensions.rowHeight * alignment.depth + dimensions.paddingTop + dimensions.paddingBottom
      } else {
        defaultRowHeight = 0
      }
    } else {
      defaultRowHeight = dimensions.rowHeight + dimensions.paddingTop + dimensions.paddingBottom
    }

    const iconConditions = []
    if (alignment?.groupBy) {
      iconConditions.push({
        // actual mapping is implemented in SequenceSeriesCell class
        // here is a placeholder so that S2 will calculate the correct
        // text and icon positions for this cell
        field: SERIES_NUMBER_FIELD,
        mapping: (nodeOrFieldValue: number, data: S2Node | unknown) => ({ icon: "", fill: "" }),
      })
    }

    return {
      dataSet: (spreadsheet) => new AVDataSet(spreadsheet as AVTableSheet),
      showSeriesNumber: !isOverviewMode,
      frozenColCount: isOverviewMode ? 0 : 1 + pinnedColumnsCount,
      frozenTrailingColCount: 1,
      frozenRowCount: Object.keys(SPECIAL_ROWS).length,
      placeholder: "",
      showDefaultHeaderActionIcon: false,
      headerActionIcons,
      style: {
        layoutWidthType: 'compact' as const,
        colCfg: {
          height: dimensions.colHeight,
        },
        rowCfg: {
          heightByField: rowHeightsByField,
          height: defaultRowHeight,
        },
        cellCfg: {
          height: defaultRowHeight,
        }
      },
      customSVGIcons: [
        {
          name: 'ExportOutlined',
          svg: svgExport,
        }, {
          name: 'Sort',
          svg: svgSort,
        }, {
          name: 'SortAsc',
          svg: svgSortAsc,
        }, {
          name: 'SortDesc',
          svg: svgSortDesc,
        }, {
          name: 'AntdPlus',
          svg: svgPlus,
        }, {
          name: 'AntdMinus',
          svg: svgMinus,
        }, {
          name: 'Filter',
          svg: svgFilter,
        }, {
          name: 'Group',
          svg: svgGroup,
        },
      ],
      conditions: {
        icon: iconConditions,
      },
      devicePixelRatio,
      hdAdapter: false,
      tooltip: {
        showTooltip: false,
      },
      interaction: {
        enableCopy: false, // use our own implementation for copy
        copyWithFormat: true,
        scrollbarPosition: ScrollbarPositionType.CANVAS,
        overscrollBehavior: "none" as const,
        // brushSelection: false,
        // multiSelection: false,
        // rangeSelection: false,
        resize: {
          rowCellVertical: false,
          cornerCellHorizontal: false,
          colCellHorizontal: true,
          colCellVertical: false, // true if we want the header to be vertically resizable
          // visible: (cell: S2CellType) => {
          //   // Use fixed-width sequence column, because when the column width is too small,
          //   // the text will be truncated and appended with an ellipsis that is a hard-coded
          //   // 3-char "...", which cannot be.
          //   // return !["__sequenceIndex__", SERIES_NUMBER_FIELD].includes(cell.getMeta().field)
          //   return !["__sequenceIndex__", SERIES_NUMBER_FIELD].includes(cell.getMeta().field)
          // },
          disable: (resizeInfo) => (resizeInfo.id === "__sequenceIndex__"),
        },
        hoverHighlight: {
          rowHeader: false,
          currentRow: highlightCurrentSequence,
          colHeader: false,
          currentCol: false,
        },
        selectedCellHighlight: false,
        selectedCellMove: false,
        hoverFocus: false,
      },
      layoutCoordinate,
      colCell,
      dataCell,
    } as SheetComponentOptions
  }, [
    pinnedColumnsCount, 
    isOverviewMode, 
    devicePixelRatio,
    dimensions, 
    alignment?.depth,
    alignment?.groupBy,
    rowHeightsByField, 
    highlightCurrentSequence, 
    headerActionIcons,
    layoutCoordinate,
    dataCell,
  ])
}


export function useS2ThemeCfg(
  fontFamily: string,
  dimensions: TDimensions,
  scrollbarSize: number,
  highlightCurrentSequence: boolean,
  colorTheme: TAVColorTheme,
): ThemeCfg {
  return useMemo(() => {
    const darkMode: boolean = !readableColorIsBlack(colorTheme.background)
    const palette = {
      ...PALETTE_MAP.gray,
      basicColors: [
        colorTheme.headerText, // 角头字体、列头字体
        colorTheme.backgroundAlt, // 行头背景、数据格背景(斑马纹)
        colorTheme.backgroundOnHover, // 行头&数据格交互(hover、选中、十字)
        colorTheme.headerBackground, // 角头背景、列头背景
        colorTheme.headerBackgroundOnHover, // 列头交互(hover、选中)
        colorTheme.selectionMask, // 刷选遮罩
        colorTheme.link, // 行头 link
        colorTheme.resizeIndicator, // mini bar、resize 交互(参考线等)
        colorTheme.background, // 数据格背景(非斑马纹)、整体表底色(建议白色)
        colorTheme.border, // 行头边框、数据格边框
        colorTheme.headerBorder, // 角头边框、列头边框
        colorTheme.verticalSplitLine, // 竖向大分割线
        colorTheme.horizontalSplitLine, // 横向大分割线
        colorTheme.text, // 数据格字体
        colorTheme.borderOnHover, // 行头字体、数据格交互色(hover)
      ]
    }

    const commonTextTheme = {
      fontSize: dimensions.fontSize,
      fontFamily: fontFamily,
      // fill: "#9da7b6",
      // linkTextFill: "#873bf4",
    }
  
    const commonCellTheme = {
      // backgroundColor: 'transparent',
      // crossBackgroundColor: '#1a1a1a',
      // horizontalBorderColor: "transparent",
      // horizontalBorderWidth: 0,
      // verticalBorderColor: "transparent",
      // verticalBorderWidth: 0,
      padding: {
        left: dimensions.paddingLeft,
        right: dimensions.paddingRight,
        top: dimensions.paddingTop,
        bottom: dimensions.paddingBottom,
      }
    }
  
    const commonIconTheme = {
      // fill: colorTheme.borderOnHover,
      fill: colorTheme.headerText,
      stroke: colorTheme.headerText,
      size: dimensions.iconSize,
      margin: {
        left: dimensions.iconMarginLeft,
        right: dimensions.iconMarginRight,
      },
    }
  
    return {
      palette: palette,
      theme: {
        // background: {
        //   color: 'transparent',
        // },
        rowCell: {
          seriesNumberWidth: dimensions.cornerCellWidth,
          text: commonTextTheme,
          seriesText: {
            ...commonTextTheme,
            // fill: "#9da7b6", // s2?.theme.dataCell?.miniChart?.bar?.fill//.rowCell?.text?.linkTextFill,
            textAlign: "right",
          },
          icon: commonIconTheme,
          cell: {
            ...commonCellTheme,
            horizontalBorderWidth: 0,
            backgroundColor: colorTheme.headerBackground, // s2?.theme.colCell?.cell?.backgroundColor,
            // crossBackgroundColor: "#f0f2f4", 
            interactionState: {
              hover: {
                backgroundColor: "transparent",
                // borderWidth: 4,
                // backgroundColor: colorTheme.backgroundOnHover, // colorTheme.headerText,
                // backgroundOpacity: 1,
              },
            }
          }
        },
        colCell: {
          text: commonTextTheme,
          // seriesText: commonTextTheme,
          bolderText: commonTextTheme,
          icon: commonIconTheme,
          cell: {
            ...commonCellTheme,
            // interactionState: {
            //   hover: {
            //     borderWidth: 4,
            //     backgroundColor: colorTheme.backgroundOnHover, // colorTheme.headerText,
            //     backgroundOpacity: 1,
            //   },
            // },
          },
        },
        cornerCell: {
          // seriesText: commonTextTheme,
          icon: commonIconTheme,
          cell: commonCellTheme,
        },
        dataCell: {
          text: {
            ...commonTextTheme,
            textAlign: "right",
          },
          icon: commonIconTheme,
          cell: {
            // backgroundColor: "#E7E9ED",
            // horizontalBorderColor: "transparent",
            // horizontalBorderWidth: 0,
            // verticalBorderColor: "transparent",
            // verticalBorderWidth: 0,
            ...commonCellTheme,
            horizontalBorderWidth: 0,
            interactionState: {
              hover: {
                backgroundColor: "transparent",
              },
              hoverFocus: {
                // borderColor: "transparent",
                borderWidth: 0,
                backgroundColor: "transparent",
                cursor: "pointer",
              },
              prepareSelect: {
                borderWidth: 2,
                borderColor: colorTheme.backgroundOnHover,
                borderOpacity: 1.0,
                backgroundColor: colorTheme.backgroundOnHover,
                backgroundOpacity: 0.3,
              },
              selected: {
                borderWidth: 2,
                borderColor: colorTheme.backgroundOnHover,
                borderOpacity: 1.0,
                backgroundColor: colorTheme.backgroundOnHover,
                backgroundOpacity: 0.3,
              }
            }
          }
        }, 
        scrollBar: {
          trackColor: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.01)',
          thumbHoverColor: darkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.25)',
          thumbColor: darkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)',
          // trackColor: darkMode ? '#151617' : '#FCFCFC',
          // thumbHoverColor: darkMode ? '#6E757F' : '#BFBFBF',
          // thumbColor: darkMode ? '#565C64' : '#D9D9D9',
          size: scrollbarSize,
          hoverSize: scrollbarSize * 1.2,
        },
        splitLine: {
          // showShadow: false,
          shadowWidth: darkMode ? 8 : 10,
          shadowColors: {
            left: darkMode ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.1)',
            right: darkMode ? 'rgba(255, 255, 255, 0)' : 'rgba(0, 0, 0, 0)',
          },
        },
      }
    } as ThemeCfg
  }, [
    fontFamily, 
    dimensions, 
    scrollbarSize, 
    // highlightCurrentSequence,
    colorTheme,
  ])
}

export function useS2DataCfg(
  alignment: TAlignment | undefined, 
  sortedDisplayedIndices: number[], 
  isCollapsedGroup: boolean[],
  columns: string[], 
  isOverviewMode: boolean,
) {
  console.log("useS2DataCfg", alignment?.name, columns)
  return useMemo(() => {
    const data: DataType[] = []
    const groupSizeAtRowIndex: number[] = []
    const isCollapsedGroupAtRowIndex: boolean[] = []
    if (alignment?.annotations) {
      for (const key of Object.keys(SPECIAL_ROWS)) {
        data.push({ __sequenceIndex__: key })
        groupSizeAtRowIndex.push(1)
        isCollapsedGroupAtRowIndex.push(false)
      }
  
      if (isOverviewMode) {
        data.push({ __sequenceIndex__: "$$overview$$"})
        groupSizeAtRowIndex.push(-1)
        isCollapsedGroupAtRowIndex.push(false)
      } else {
        for (let i = 0; i < sortedDisplayedIndices.length; ++i) {
          isCollapsedGroupAtRowIndex.push(isCollapsedGroup[i])
          const sequenceIndex = sortedDisplayedIndices[i]
          data.push({ __sequenceIndex__: sequenceIndex })
          groupSizeAtRowIndex.push(alignment.annotations.__groupSize__[sequenceIndex])
        }
      }
    }

    return ({
      s2DataCfg:{
        fields: {
          columns, 
        },
        meta: columns.map((field: string) => ({
          field, 
          name: alignment?.annotationFields[field]?.name ?? formatFieldName(field)
        })),
        data,
        // sortParams: [
        //   {
        //     sortFieldId: 'realLength',
        //     sortMethod: 'desc',
        //   },
        // ],
      }, 
      firstResidueColIndex: columns.length - 1,
      firstSequenceRowIndex: Object.keys(SPECIAL_ROWS).length,
      groupSizeAtRowIndex,
      isCollapsedGroupAtRowIndex,
    })
  }, [
    columns, 
    alignment?.annotations, 
    alignment?.annotationFields, 
    sortedDisplayedIndices, 
    isCollapsedGroup,
    isOverviewMode
  ])
}


