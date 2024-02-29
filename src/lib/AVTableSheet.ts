import type { MutableRefObject } from 'react'
import type { 
  SpreadSheet, ColHeaderConfig, S2MountContainer, S2DataConfig, ScrollbarPositionType, 
  S2Options, ThemeCfg, LayoutResult, S2RenderOptions, ViewMeta, S2CellType, ScrollOffset,
  HeaderIconClickParams, HeaderActionIconProps
} from '@antv/s2'
import type { SheetComponentOptions } from '@antv/s2-react'
import type { IGroup, IShape, Event as GraphEvent, Shape } from '@antv/g-canvas'
import type { TAlignment, TSequence, TFormattedSequences, TAlignmentSortParams } from './Alignment'
import type { TDimensions, TAVColorTheme } from '../components/AlignmentViewer'

import { find, countBy, debounce, isNumber } from 'lodash'
import { 
  TableSheet, Store, TableDataCell, SERIES_NUMBER_FIELD, 
  BaseCell, PALETTE_MAP, S2Event, FrozenGroup, Node as S2Node, 
} from '@antv/s2'
import { useMemo } from 'react'
import { readableColorIsBlack } from 'color2k'

import {
  SequenceColCell, SequenceDataCell, BarDataCell, TextColCell, MinimapColCell, 
  SequenceSeriesCell, TextDataCell, SequenceIdDataCell, LogoDataCell, 
  DummyMinimapDataCell, SequenceSeriesColCell, 
} from './cells'
import { ShapeBaseSupportingOffscreenCanvas } from './OffscreenCanvas'
import { svgExport, svgSort, svgSortAsc, svgSortDesc, svgPlus, svgMinus } from './icons'
import { formatFieldName } from './Alignment'


export const SEQUENCE_LOGO_ROW_HEIGHT_RATIO = 3
export const SPECIAL_ROWS = {
  "$$reference$$": {
    label: "Reference",
    height: 2.5,
    renderer: SequenceDataCell,
    defaultVisible: true,
  }, 
  "$$consensus$$": {
    label: "Consensus",
    height: 1,
    renderer: SequenceDataCell,
    defaultVisible: true,
  }, 
  "$$sequence logo$$": {
    label: "Sequence Logo",
    height: SEQUENCE_LOGO_ROW_HEIGHT_RATIO,
    renderer: LogoDataCell,
    defaultVisible: true,
  }, 
  "$$coverage$$": {
    label: "Coverage",
    height: 1.5,
    renderer: BarDataCell,
    defaultVisible: true,
  }, 
  "$$conservation$$": {
    label: "Conservation",
    height: 1.5,
    renderer: BarDataCell,
    defaultVisible: true,
  }, 
  "$$entropy$$": {
    label: "Entropy",
    height: 1.5,
    renderer: BarDataCell,
    defaultVisible: false,
  }, 
  "$$kl divergence$$": {
    label: "KL Divergence",
    height: 1.5,
    renderer: BarDataCell,
    defaultVisible: false,
  }, 
} as const

const FOREGROUND_GROUP_MINIMAP_GROUP_Z_INDEX = 10
const KEY_FOREGROUND_GROUP_MINIMAP_GROUP = "minimapGroup"
export const OVERVIEW_MODE_ZOOM = 5

export type TAVExtraOptions = Record<string, any>
export class AVTableSheet extends TableSheet {
  public readonly id = Math.random()
  public avStore = new Store()
  protected minimapBackgroundShape?: IShape
  protected minimapShape?: IShape
  protected minimapViewportShape?: IShape
  protected maxScrollOffsetY = 0
  protected prevScrollY? = 0
  protected isMinimapScrolling = false
  protected minimapScrollAnchorY = 0
  // protected minimapHeight = 0
  // protected minimapRealHeight = 0
  protected sequenceGroupDividerGroup?: IGroup
  protected checkContextLostTimeInterval: number = 0

  constructor(dom: S2MountContainer, dataCfg: S2DataConfig, options: S2Options, initialAVStore: TAVExtraOptions) {
    super(dom, dataCfg, options)
    this.updateAVStore(initialAVStore)
    this.avStore.set("visibleSequencePositionStart", -1)
    this.avStore.set("visibleSequencePositionEnd", -1)
    this.avStore.set("visibleSequenceIndexStart", -1)
    this.avStore.set("visibleSequenceIndexEnd", -1)
    this.on(S2Event.GLOBAL_SCROLL, this.handleScrollbarScroll.bind(this))
    this.on(S2Event.GLOBAL_MOUSE_MOVE, this.handleMouseMove.bind(this))
    this.on(S2Event.GLOBAL_MOUSE_UP, this.handleMouseUp.bind(this))
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
    for (const [k, v] of Object.entries(newAVStore)) {
      this.avStore.set(k, v)
    }
  }

  protected buildFacet(): void {
    const ctx = this.getCanvasElement().getContext("2d")
    // const ctx = this.container.get("context") as CanvasRenderingContext2D
    if (ctx) {
      ctx.imageSmoothingEnabled = false
      ctx.textRendering = "optimizeSpeed"
      ctx.fontKerning = "none"
    }
  
    console.log("buildFacet")
    this.minimapBackgroundShape?.off("mousedown")
    this.minimapShape?.off("mousedown")
    this.minimapViewportShape?.off("mousedown")
    super.buildFacet()
    // const oldGetGridInfo = this.facet.getGridInfo
    // this.facet.getGridInfo = () => {
    //   return {
    //     cols: oldGetGridInfo().cols,
    //     rows: [],
    //   }
    // }
  
    const showMinimap = this.avStore.get("showMinimap") as boolean
    if (showMinimap) {
      this.renderMinimap()
    }

    this.updateSequenceCells()
    this.renderSequenceGroupDividers()
  }

  protected handleMouseDown(event: GraphEvent) {
    this.isMinimapScrolling = true
    this.minimapScrollAnchorY = event.y - this.minimapViewportShape?.attr("y")
    if ((this.minimapScrollAnchorY < 0) || (this.minimapScrollAnchorY > this.minimapViewportShape?.attr("height"))) {
      // this.minimapScrollAnchorY = 0 // top of minimapViewport
      this.minimapScrollAnchorY = this.minimapViewportShape?.attr("height") / 2 // center of minimapViewport
    }
    this.minimapScrollTo(event.y - this.minimapScrollAnchorY)
    // console.log("mousedown", (event.y - this.minimapBackgroundShape?.attr("y")), this.minimapBackgroundShape?.attr("height"))
  }
  
  protected handleMouseMove(event: MouseEvent) {
    if (this.isMinimapScrolling) {
      this.minimapScrollTo(event.offsetY - this.minimapScrollAnchorY)
    }
  }

  protected handleMouseUp() {
    if (this.isMinimapScrolling) {
      this.isMinimapScrolling = false
      this.minimapScrollAnchorY = 0
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
    this.updateSequenceCells()
    this.renderSequenceGroupDividers()

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
    const alignment = this.avStore.get("alignment") as TAlignment
    const isOverviewMode = this.avStore.get("isOverviewMode") as boolean
    const dimensions = this.avStore.get("dimensions") as TDimensions
    if (!dimensions) {
      return
    }
    
    const { scrollX = 0, scrollY = 0 } = this.facet.getScrollOffset()
    const { x: sequenceCellX, y: sequenceCellY } = find(this.facet.layoutResult.colLeafNodes, { field: "__sequenceIndex__" }) as S2Node
    const { x: clipX, y: clipY, width: clipWidth, height: clipHeight } = this.panelScrollGroup.getClip().getBBox()

    const right = clipX + clipWidth - scrollX
    for (const shape of this.foregroundGroup.findById("frozenSplitLine").getChildren()) {
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

    let visibleSequencePositionStart: number, visibleSequencePositionEnd: number
    const { residueWidth, residueHeight } = dimensions
    if (clipX + clipWidth < sequenceCellX) { // sequence column not visible
      visibleSequencePositionStart = -1
      visibleSequencePositionEnd = -1
    } else {
      visibleSequencePositionStart = Math.floor((clipX - sequenceCellX) / residueWidth)
      if (visibleSequencePositionStart < 0) {
        visibleSequencePositionStart = 0
      }

      visibleSequencePositionEnd = Math.ceil((clipX + clipWidth - sequenceCellX) / residueWidth)
      if (visibleSequencePositionEnd >= alignment.length) {
        visibleSequencePositionEnd = alignment.length - 1
      }
    }
    
    this.avStore.set("visibleSequencePositionStart", visibleSequencePositionStart)
    this.avStore.set("visibleSequencePositionEnd", visibleSequencePositionEnd)

    if (visibleSequencePositionStart < 0) {
      return
    }

    let visibleSequenceIndexStart: number, visibleSequenceIndexEnd: number // values are only valid and used in overview mode
    if (isOverviewMode) {
      visibleSequenceIndexStart = Math.floor(scrollY / residueHeight)
      if (visibleSequenceIndexStart < 0) {
        visibleSequenceIndexStart = 0
      }

      visibleSequenceIndexEnd = Math.ceil((scrollY + clipHeight) / residueHeight)
      if (visibleSequenceIndexEnd >= alignment.depth) {
        visibleSequenceIndexEnd = alignment.depth - 1
      }
    } else {
      visibleSequenceIndexStart = -1
      visibleSequenceIndexEnd = -1
      // ({start: visibleSequenceIndexStart, end: visibleSequenceIndexEnd} = this.facet.viewCellHeights.getIndexRange(clipY, clipY + clipHeight - 1))
      // visibleSequenceIndexStart -= firstSequenceRowIndex
      // visibleSequenceIndexEnd -= firstSequenceRowIndex
    }

    this.avStore.set("visibleSequenceIndexStart", visibleSequenceIndexStart)
    this.avStore.set("visibleSequenceIndexEnd", visibleSequenceIndexEnd)

    // console.log("afterDynamicRenderCell", "__sequenceIndex__", visibleSequencePositionStart, visibleSequencePositionEnd)
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
    console.log("render minimap")
    const minimapImage = this.avStore.get("minimapImage") as OffscreenCanvas
    if (!minimapImage) {
      return
    }

    const dimensions = this.avStore.get("dimensions") as TDimensions
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

    const scrollbarSize = this.avStore.get("scrollbarSize") as number
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
    const minimapMaxHeight = panelGroupHeight
    const scale = Math.min(minimapMaxWidth / minimapImage.width, minimapMaxHeight / minimapImage.height)
    const minimapWidth = scale * minimapImage.width
    const minimapHeight = scale * minimapImage.height
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
        imageSmoothingEnabled: false,
      }
    })

    // const minimapViewportX = Math.round(minimapColNode.x + (minimapMaxWidth - minimapWidth) / 2)
    let minimapViewportX = minimapBackgroundX + dimensions.minimapMargin
    if (minimapViewportX > minimapX) {
      minimapViewportX = minimapX
    }
    // const minimapViewportWidth = Math.round(Math.max(minimapMaxWidth, minimapWidth))
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

    this.minimapBackgroundShape.on("mousedown", this.handleMouseDown.bind(this))
    this.minimapShape.on("mousedown", this.handleMouseDown.bind(this))
    this.minimapViewportShape.on("mousedown", this.handleMouseDown.bind(this))
  }

  renderSequenceGroupDividers() {
    const isOverviewMode = this.avStore.get("isOverviewMode") as boolean
    if (isOverviewMode) {
      return
    }

    const alignment = this.avStore.get("alignment") as TAlignment
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
    const sortedDisplayedIndices = this.avStore.get("sortedDisplayedIndices") as number[]
    const firstSequenceRowIndex = this.avStore.get("firstSequenceRowIndex") as number
    const collapsedGroups = this.avStore.get("collapsedGroups") as number[]
    let { minX: panelScrollGroupMinX, maxX: panelScrollGroupMaxX } = this.panelScrollGroup.getBBox()
    let { minX: frozenColGroupMinX, maxX: frozenColGroupMaxX } = this.frozenColGroup.getBBox()
    let [ colMin, colMax, rowMin = 0, rowMax = 0 ] = this.facet.preCellIndexes.center
    for (let rowIndex = rowMin + 1; rowIndex <= rowMax; ++rowIndex) {
      const groupIndex = alignment.sequences[sortedDisplayedIndices[rowIndex - firstSequenceRowIndex]].__groupIndex__
      if (collapsedGroups.includes(groupIndex)) {
        continue
      }

      const prevRowGroupIndex = alignment.sequences[sortedDisplayedIndices[rowIndex - 1 - firstSequenceRowIndex]].__groupIndex__
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

}

export type TColumnWidths = {
  alignmentUuid: string | undefined,
  fieldWidths: Record<string, number>,
  isGrouped: boolean,
  isOverviewMode: boolean,
  isResizing: boolean,
}

export function useS2Options(
  alignment: TAlignment | null,
  columns: string[],
  columnWidthsRef: MutableRefObject<TColumnWidths>,
  pinnedColumnsCount: number,
  sortBy: TAlignmentSortParams[],
  collapsedGroups: number[],
  isOverviewMode: boolean,
  dimensions: TDimensions, 
  iconSize: number, 
  iconMarginLeft: number, 
  iconMarginRight: number,
  scrollbarSize: number,
  showMinimap: boolean, 
  rowHeightsByField: Record<string, number>, 
  highlightCurrentSequence: boolean, 
  onSortActionIconClick: (props: HeaderIconClickParams) => void,
): SheetComponentOptions {
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

    const iconConditions = []
    if (alignment?.groupBy) {
      iconConditions.push(
        {
          // actual mapping is implemented in SequenceSeriesCell class
          // here is a placeholder so that S2 will calculate the correct
          // text and icon positions for this cell
          field: SERIES_NUMBER_FIELD,
          mapping: (nodeOrFieldValue: number, data: S2Node | unknown) => ({
            icon: "",
            fill: "",
          }),
        }, /*{
          field: alignment.groupBy,
          mapping: (nodeOrFieldValue: number, data: S2Node | unknown) => ({
            icon: "ExportOutlined",
            fill: "",
          }),
        }, {
          field: "id",
          mapping(fieldValue: number | string, data: TSequence) {
            return {
              icon: data.links ? "ExportOutlined" : undefined, 
              cursor: "pointer",
            };
          },
        },*/
      )
    }

    return {
      showSeriesNumber: !isOverviewMode,
      frozenColCount: isOverviewMode ? 0 : 1 + pinnedColumnsCount,
      frozenTrailingColCount: 1,
      frozenRowCount: Object.keys(SPECIAL_ROWS).length,
      // hierarchyType: 'tree',
      placeholder: "",
      showDefaultHeaderActionIcon: false,
      headerActionIcons: [
        {
          iconNames: ['Sort'],
          belongsCell: 'colCell',
          // defaultHide: true,
          displayCondition: (node: S2Node, iconName: string) => {
            return otherSortableColumns.includes(node.field)
          },
          onClick: onSortActionIconClick
        }, {
          iconNames: ['SortAsc'],
          belongsCell: 'colCell',
          // defaultHide: true,
          displayCondition: (node: S2Node, iconName: string) => {
            return ascendingColumns.includes(node.field)
          },
          onClick: onSortActionIconClick
        }, {
          iconNames: ['SortDesc'],
          belongsCell: 'colCell',
          // defaultHide: true,
          displayCondition: (node: S2Node, iconName: string) => {
            return descendingColumns.includes(node.field)
          },
          onClick: onSortActionIconClick
        },
      ],
      // mergedCellsInfo: [],
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
        }
      ],
      conditions: {
        icon: iconConditions,
      },
      hdAdapter: false,
      tooltip: {
        showTooltip: false,
      },
      interaction: {
        scrollbarPosition: "canvas" as ScrollbarPositionType,
        overscrollBehavior: "none" as const,
        brushSelection: false,
        multiSelection: false,
        rangeSelection: false,
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
      layoutCoordinate: (spreadsheet: SpreadSheet, rowNode: S2Node, colNode: S2Node) => {
        if (!colNode) {
          return
        }

        if (
          (!columnWidthsRef.current.isResizing) && 
          (alignment?.uuid === columnWidthsRef.current.alignmentUuid) &&
          (isOverviewMode === columnWidthsRef.current.isOverviewMode)
        ) {
          const colWidth = columnWidthsRef.current.fieldWidths[colNode.field]
          if (
            (colWidth !== undefined) && 
            (colNode.field !== "$$minimap$$") &&
            (
              (colNode.field !== SERIES_NUMBER_FIELD) || 
              (columnWidthsRef.current.isGrouped === !!alignment?.groupBy)
            )
          ) {
            colNode.width = colWidth
            return
          }
        }

        const iconCount = countBy(spreadsheet.options.conditions?.icon, "field")[colNode.field]
        if (iconCount) {
          colNode.width += (iconSize + iconMarginLeft) * iconCount + iconMarginRight
        }

        switch (colNode.field) {
          case "$$minimap$$":
            if (showMinimap && alignment?.length && alignment?.depth) {
              const dpr = window.devicePixelRatio
              const maxMinimapHeight = spreadsheet.getCanvasElement().height / dpr - dimensions.colHeight
              const scale = Math.min(dimensions.maxMinimapWidth / alignment.length, maxMinimapHeight / alignment.depth)
              const minimapWidth = Math.max(scale * alignment.length, dimensions.minMinimapWidth)
              colNode.width = minimapWidth + scrollbarSize + 2 * dimensions.minimapMargin
            } else {
              colNode.width = scrollbarSize
            }
            break
          case "__sequenceIndex__":
            if (alignment?.length) {
              colNode.width = dimensions.residueWidth * alignment.length // + scrollbarSize, // + dimensions.paddingLeft + dimensions.paddingRight
            }
            break
        }
      },
      colCell: (node: S2Node, spreadsheet: SpreadSheet, headerConfig: ColHeaderConfig) => {
        if (node.field === SERIES_NUMBER_FIELD) {
          return new SequenceSeriesColCell(node, spreadsheet, headerConfig)
        } else if (node.field === "__sequenceIndex__") {
          return new SequenceColCell(node, spreadsheet, headerConfig)
        } else if (node.field === "$$minimap$$") {
          return new MinimapColCell(node, spreadsheet, headerConfig)
        } else {
          return new TextColCell(node, spreadsheet, headerConfig)
        }
      },
      dataCell: (viewMeta: ViewMeta) => {
        if (viewMeta.spreadsheet.options.showSeriesNumber && viewMeta.colIndex === 0) {
          return new SequenceSeriesCell(viewMeta, viewMeta?.spreadsheet)
        } else if (viewMeta.valueField === "__sequenceIndex__") {
          const sequenceIndex = viewMeta.fieldValue as string | number
          let renderer: TableDataCell
          if (isNumber(sequenceIndex)) {
            renderer = SequenceDataCell
            if (alignment?.groupBy) {
              const groupIndex = alignment.sequences[sequenceIndex].__groupIndex__
              if (collapsedGroups.includes(groupIndex)) {
                renderer = LogoDataCell
              }
            }
          } else {
            renderer = SPECIAL_ROWS[sequenceIndex as keyof typeof SPECIAL_ROWS]?.renderer ?? SequenceDataCell
          }
          return new renderer(viewMeta, viewMeta?.spreadsheet)
        } else if (viewMeta.valueField === "$$minimap$$") {
          return new DummyMinimapDataCell(viewMeta, viewMeta?.spreadsheet)
        } else if (viewMeta.valueField === "id") {
          return new SequenceIdDataCell(viewMeta, viewMeta?.spreadsheet)
        } else {
          return new TextDataCell(viewMeta, viewMeta?.spreadsheet)
        }
      },
    } as SheetComponentOptions
  }, [
    columns,
    columnWidthsRef,
    pinnedColumnsCount, 
    sortBy,
    collapsedGroups,
    isOverviewMode, 
    dimensions, 
    iconSize,
    iconMarginLeft,
    iconMarginRight, 
    alignment?.uuid,
    alignment?.length, 
    alignment?.depth,
    alignment?.groupBy,
    alignment?.sequences,
    rowHeightsByField, 
    highlightCurrentSequence, 
    scrollbarSize,
    showMinimap, 
    onSortActionIconClick, 
  ])
}


export function useS2ThemeCfg(
  fontFamily: string,
  dimensions: TDimensions,
  iconSize: number,
  iconMarginLeft: number,
  iconMarginRight: number,
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
      fill: colorTheme.borderOnHover,
      size: iconSize,
      margin: {
        left: iconMarginLeft,
        right: iconMarginRight,
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
          }
        },
        colCell: {
          text: commonTextTheme,
          // seriesText: commonTextTheme,
          bolderText: commonTextTheme,
          icon: commonIconTheme,
          cell: commonCellTheme,
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
              hoverFocus: {
                // borderColor: "transparent",
                borderWidth: 0,
                backgroundColor: highlightCurrentSequence? undefined : "transparent",
                cursor: "pointer"
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
          // shadowColors: {
          //   left: darkMode ? '#858E9B' : 'rgba(0, 0, 0, 0.1)',
          //   right: darkMode ? '#151617' : 'rgba(0, 0, 0, 0)',
          // },
        },
      }
    } as ThemeCfg
  }, [
    fontFamily, 
    dimensions, 
    iconSize,
    iconMarginLeft,
    iconMarginRight,
    scrollbarSize, 
    highlightCurrentSequence,
    colorTheme,
  ])
}

type TAVTableDataType = {
  id: string,
  __sequenceIndex__: string | number,
}

export function useS2DataCfg(
  alignment: TAlignment | null, 
  sortedDisplayedIndices: number[], 
  columns: string[], 
  isOverviewMode: boolean,
) {
  return useMemo(() => {
    const data: TAVTableDataType[] = []
    for (const key of Object.keys(SPECIAL_ROWS) as (keyof typeof SPECIAL_ROWS)[]) {
      data.push({ id: SPECIAL_ROWS[key].label, __sequenceIndex__: key })
    }

    if (isOverviewMode) {
      data.push({id: "$$overview$$", __sequenceIndex__: "$$overview$$"})
    } else if (alignment?.sequences) {
      for (const i of sortedDisplayedIndices) {
        data.push(alignment?.sequences[i])
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
      firstSequenceRowIndex: Object.keys(SPECIAL_ROWS).length
    })
  }, [columns, alignment?.annotationFields, sortedDisplayedIndices, alignment?.sequences, isOverviewMode])
}
