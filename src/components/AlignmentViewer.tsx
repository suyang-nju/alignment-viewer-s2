"use client"

import type { ReactNode, CSSProperties } from 'react'
import type {
  S2DataConfig, 
  S2Options, 
  S2MountContainer, 
  TargetCellInfo, 
  LayoutResult, 
  ResizeParams,
  SpreadSheet, 
  TableSheet, 
  ViewMeta, 
  S2CellType, 
  ScrollbarPositionType, 
  ColHeaderConfig, 
  HeaderIconClickParams, 
  BaseCell,  
} from '@antv/s2'
import type { LooseObject, Event as CanvasEvent } from '@antv/g-canvas'
import type { SheetComponentOptions, SheetComponentsProps } from '@antv/s2-react'
import type { TAlignment, TSequence, TAlignmentPositionsToStyle, TAlignmentSortParams } from '../lib/Alignment'
import type { TAlignmentColorMode, TColorEntry, TAlignmentColorPalette } from '../lib/AlignmentColorSchema'
import type { TColumnWidths } from '../lib/AVTableSheet'

import {
  AVTableSheet, 
  SPECIAL_ROWS, 
  SEQUENCE_LOGO_ROW_HEIGHT_RATIO,
  useS2Options, 
  useS2ThemeCfg, 
  useS2DataCfg, 
  HIDDEN_ANNOTATION_FIELDS, 
} from '../lib/AVTableSheet'
import { alignmentColorModes } from '../lib/AlignmentColorSchema'
import Sprites from '../lib/sprites'
import BarSprites from '../lib/BarSprites'
import { SequenceLogos, SequenceLogosGroups } from '../lib/sequenceLogos'

import clsx from 'clsx'
import { spawn, Thread, Worker } from 'threads'
// const { spawn, Thread, Worker } = require('threads')
import { isNil, countBy, sortBy, range } from 'lodash'

import { useRef, useMemo, useState, useEffect, useCallback, } from 'react'
import { Node as S2Node, generateId, GuiIcon, SERIES_NUMBER_FIELD,  } from '@antv/s2'
import { setLang, extendLocale } from '@antv/s2'
import { SheetComponent } from '@antv/s2-react'
import '@antv/s2-react/dist/style.min.css'


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

declare global {
  interface Window {
    s2: unknown
  }
}

export type TAVColorTheme = {
  headerText: string, // 角头字体、列头字体
  backgroundAlt: string, // 行头背景、数据格背景(斑马纹)
  backgroundOnHover: string, // 行头&数据格交互(hover、选中、十字)
  headerBackground: string, // 角头背景、列头背景
  headerBackgroundOnHover: string, // 列头交互(hover、选中)
  selectionMask: string, // 刷选遮罩
  link: string, // '#69b1ff', // '#565C64', // 行头 link
  resizeIndicator: string, // mini bar、resize 交互(参考线等)
  background: string, // 数据格背景(非斑马纹)、整体表底色(建议白色)
  border: string, // 行头边框、数据格边框
  headerBorder: string, // 角头边框、列头边框
  verticalSplitLine: string, // 竖向大分割线
  horizontalSplitLine: string, // 横向大分割线
  text: string, // 数据格字体
  borderOnHover: string, // 行头字体、数据格交互色(hover)
}


export type TAlignmentViewerToggles = Record<string, {label: string, visible: boolean}>
const defaultAlignmentViewerToggles = {} as TAlignmentViewerToggles
for (const [k, v] of Object.entries(SPECIAL_ROWS)) {
  defaultAlignmentViewerToggles[k] = {label: v.label, visible: v.defaultVisible}
}
defaultAlignmentViewerToggles["$$MiniMap$$"] = {label: "MiniMap", visible: true}
export { defaultAlignmentViewerToggles }


// export type TAlignmentViewerToggles = Record<keyof typeof defaultToggles, boolean>
export type TContextualInfo = {
  key: string,
  sequenceIndex?: number | string,
  residueIndex?: number,
  row?: number,
  col?: number,
  sequenceId?: string,
  content: ReactNode[],
  anchorX: number,
  anchorY: number,
  anchorWidth: number,
  anchorHeight: number,
}
export type TSetContextualInfo = (info?: TContextualInfo) => void

export type TDimensions = {
  zoom: number,
  fontFamily: string,
  residueFontFamily: string,
  fontSize: number,
  regularTextHeight: number,
  residueFontWidth: number, 
  residueFontHeight: number, 
  residueFontActualBoundingBoxAscents: number[], 
  residueFontActualBoundingBoxDescents: number[],
  residueWidth: number, 
  residueHeight: number,
  residueLetterSpacing: string,
  paddingLeft: number,
  paddingRight: number,
  paddingTop: number,
  paddingBottom: number,
  rowHeight: number,
  cornerCellWidth: number,
  residueNumberFontSize: number,
  residueNumberHeight: number,
  residueNumberTextActualBoundingBoxDescent: number,
  colHeight: number,
  minMinimapWidth: number,
  maxMinimapWidth: number,
  minimapMargin: number, 
}

export type TAlignmentViewerProps = {
  className?: string,
  style?: CSSProperties,
  alignment: TAlignment,
  // referenceSequenceIndex?: number,
  showColumns?: string[],
  pinnedColumns?: string[],
  sortBy?: TAlignmentSortParams[],
  collapsedGroups?: number[],
  zoom?: number,
  isOverviewMode?: boolean,
  toggles?: TAlignmentViewerToggles,
  fontFamily?: string,
  residueFontFamily?: string,
  alignmentColorPalette?: TAlignmentColorPalette,
  alignmentColorMode?: TAlignmentColorMode,
  positionsToStyle?: TAlignmentPositionsToStyle, 
  scrollbarSize?: number,
  highlightCurrentSequence?: boolean,
  colorTheme: TAVColorTheme,
  onMouseHover?: TSetContextualInfo,
  onSortActionIconClick?: (field: string) => void,
  onExpandCollapseGroupIconClick?: (groupIndex: number) => void,
  onExpandCollapseAllGroupsIconClick?: () => void,
  onContextMenu?: (data: TargetCellInfo & {data: unknown}) => void,
  onBusy?: (isBusy: boolean) => void,
}

function useDimensions(
  alignment: TAlignment,
  isOverviewMode: boolean,
  fontFamily: string, 
  residueFontFamily: string,
  zoom: number,
): TDimensions {
  return useMemo(() => {
    const minMinimapWidth = 20, maxMinimapWidth = 120, minimapMargin = 4

    const canvas = new OffscreenCanvas(0, 0)
    const ctx = canvas.getContext("2d")
    if (!ctx) {
      // console.log("Dimension EFFECT null")
      return {
        zoom,
        fontFamily,
        residueFontFamily,
        fontSize: zoom,
        regularTextHeight: 0,
        residueFontWidth: 0, 
        residueFontHeight: 0, 
        residueFontActualBoundingBoxAscents: [], 
        residueFontActualBoundingBoxDescents: [],
        residueWidth: 0, 
        residueHeight: 0,
        residueLetterSpacing: "0px",
        paddingLeft: 0,
        paddingRight: 0,
        paddingTop: 0,
        paddingBottom: 0,
        rowHeight: 0,
        cornerCellWidth: 0,
        residueNumberFontSize: 0,
        residueNumberHeight: 0,
        residueNumberTextActualBoundingBoxDescent: 0,
        colHeight: 0,
        minMinimapWidth, 
        maxMinimapWidth,
        minimapMargin,
      }
    }

    const fontSize = zoom
    let paddingLeft: number, paddingRight: number, paddingTop: number, paddingBottom: number
    let cornerCellWidth: number
    if (isOverviewMode) {
      paddingLeft = Math.ceil(zoom * 2 / 3)
      paddingRight = paddingLeft
      paddingTop = Math.ceil(zoom * 1 / 4)
      paddingBottom = paddingTop
      cornerCellWidth = Math.ceil(fontSize / 3) + paddingLeft + paddingRight
      const residueFontActualBoundingBoxAscents = Array(alignment.alphabet.length).fill(zoom)
      const residueFontActualBoundingBoxDescents = Array(alignment.alphabet.length).fill(0)

      return {
        zoom,
        fontFamily,
        residueFontFamily,
        fontSize,
        regularTextHeight: zoom,
        residueFontWidth: Math.ceil(zoom * 2 / 3), 
        residueFontHeight: zoom, 
        residueFontActualBoundingBoxAscents, 
        residueFontActualBoundingBoxDescents,
        residueWidth: zoom, 
        residueHeight: zoom,
        residueLetterSpacing: "0px",
        paddingLeft,
        paddingRight,
        paddingTop,
        paddingBottom,
        rowHeight: zoom,
        cornerCellWidth,
        residueNumberFontSize: 0,
        residueNumberHeight: 0,
        residueNumberTextActualBoundingBoxDescent: 0,
        colHeight: zoom,
        minMinimapWidth, 
        maxMinimapWidth,
        minimapMargin,
      }
    }

    // {
    //   ...s2.theme.dataCell?.text,
    //   fontSize,
    // }
    ctx.font = `${fontSize}px ${fontFamily}`
    const regularTextMetrics = ctx.measureText('M')
    const regularTextActualBoundingBoxAscent = regularTextMetrics ? regularTextMetrics.actualBoundingBoxAscent : 0
    const regularTextActualBoundingBoxDescent = regularTextMetrics ? regularTextMetrics.actualBoundingBoxDescent : 0
    const regularTextHeight = regularTextActualBoundingBoxAscent + regularTextActualBoundingBoxDescent

    // {
    //   ...s2.theme.dataCell?.text,
    //   fontFamily: residueFontFamily,
    //   fontSize,
    // }
    ctx.font = `${fontSize}px ${residueFontFamily}`
    let residueTextMetrics = ctx.measureText(alignment.alphabet)
    const residueFontWidth = (residueTextMetrics?.width / alignment.alphabet.length) ?? 0
    let residueFontHeight = 0
    const residueFontActualBoundingBoxAscents = Array(alignment.alphabet.length).fill(0)
    const residueFontActualBoundingBoxDescents = Array(alignment.alphabet.length).fill(0)
    for (let i = 0; i < alignment.alphabet.length; ++i) {
      residueTextMetrics = ctx.measureText(alignment.alphabet[i])
      residueFontActualBoundingBoxAscents[i] = residueTextMetrics.actualBoundingBoxAscent
      residueFontActualBoundingBoxDescents[i] = residueTextMetrics.actualBoundingBoxDescent
      const h = residueTextMetrics.actualBoundingBoxAscent + residueTextMetrics.actualBoundingBoxDescent
      if (h > residueFontHeight) {
        residueFontHeight = h
      }
    }
    const residueHeight = Math.ceil(residueFontHeight)
    const residueWidth = Math.ceil(residueFontWidth * 1.5)
    const residueLetterSpacing = `${residueWidth - residueFontWidth}px`

    // {
    //   ...s2.theme.cornerCell?.bolderText,
    //   fontSize,
    // }
    ctx.font = `bold ${fontSize}px ${fontFamily}`
    const seriesLabelTextMetrics = ctx.measureText('##')

    // {
    //   ...s2.theme.rowCell?.text,
    //   fontSize,
    // }
    ctx.font = `${fontFamily} ${fontSize}px`
    const seriesEntryTextMetrics = ctx.measureText(`${alignment.depth}`)
    const maxTextHeight = Math.max(regularTextHeight, residueHeight)
    paddingLeft = Math.ceil(maxTextHeight * 2/3)
    paddingRight = Math.ceil(maxTextHeight * 2/3)
    paddingTop = Math.ceil(maxTextHeight * 1/4)
    paddingBottom = Math.ceil(maxTextHeight * 1/4)
    cornerCellWidth = Math.ceil(Math.max(seriesLabelTextMetrics.width, seriesEntryTextMetrics.width)) + paddingLeft + paddingRight
    const rowHeight = Math.ceil(maxTextHeight) // + paddingTop + paddingBottom
    const residueNumberFontSize = fontSize * residueFontWidth / regularTextActualBoundingBoxAscent

    // {
    //   ...s2.theme.colCell?.text,
    //   fontSize: residueNumberFontSize,
    // }
    ctx.font = `${fontFamily} ${residueNumberFontSize}px`
    const alignmentLengthText = "9".repeat(`${alignment.length}`.length) //`${alignment.length}`
    const residueNumberTextMetrics = ctx.measureText(alignmentLengthText)
    const residueNumberHeight = Math.round(residueNumberTextMetrics.width) // residuel number labels are rotated
    const residueNumberTextActualBoundingBoxDescent = residueNumberTextMetrics.actualBoundingBoxDescent
    
    const colHeight = Math.ceil(Math.max(maxTextHeight, residueNumberHeight) + paddingTop + paddingBottom)

    return {
      zoom,
      fontFamily,
      residueFontFamily,
      fontSize,
      regularTextHeight,
      residueFontWidth,
      residueFontHeight,
      residueFontActualBoundingBoxAscents,
      residueFontActualBoundingBoxDescents,
      residueWidth,
      residueHeight,
      residueLetterSpacing,
      paddingLeft,
      paddingRight,
      paddingTop,
      paddingBottom,
      rowHeight,
      cornerCellWidth,
      residueNumberFontSize,
      residueNumberHeight,
      residueNumberTextActualBoundingBoxDescent,
      colHeight,
      minMinimapWidth, 
      maxMinimapWidth, 
      minimapMargin, 
    }
  }, [zoom, isOverviewMode, alignment.alphabet, alignment.depth, alignment.length, fontFamily, residueFontFamily])
}

function spreadsheet(container: S2MountContainer, dataCfg: S2DataConfig, options: SheetComponentOptions) {
  // console.log("new AVTableSheet instance")
  return new AVTableSheet(container, dataCfg, options as S2Options)
}

export type TTargetCellAndIconInfo = {
  event: CanvasEvent, 
  target: S2CellType<ViewMeta>, 
  viewMeta: ViewMeta | S2Node, 
  iconName: string | undefined,
}

function getTargetCellInfo(data: TargetCellInfo): TTargetCellAndIconInfo {
  let event: CanvasEvent
  let target: S2CellType<ViewMeta>
  let viewMeta: ViewMeta | S2Node
  let iconName: string | undefined
  if (data.target instanceof GuiIcon) {
    iconName = data.target.cfg.name
    event = data.event
    target = data.target.cfg.parent
    viewMeta = target.getMeta()
  } else {
    ({ event, target, viewMeta } = data)
  }
  return { event, target, viewMeta, iconName }
}

export function getAlignmentAnnotationFields(alignment: TAlignment) {
  const importedFields: string[] = []
  const derivedFields: string[] = []
  if (alignment?.annotationFields) {
    for (const field of Object.keys(alignment.annotationFields)) {
      if (HIDDEN_ANNOTATION_FIELDS.includes(field)) {
        continue
      }

      if (field.startsWith("__") && field.endsWith("__")) {
        derivedFields.push(field)
      } else {
        importedFields.push(field)
      }
    }  
  }
  return { importedFields, derivedFields }
}


export default function AlignmentViewer(alignmentViewerProps: TAlignmentViewerProps) {
  // console.log("render av")
  // console.log("alignment", alignment.uuid, alignment.shape)
  // console.log("zoom", zoom)
  // console.log("showMiniMap", showMiniMap)
  // console.log("residueFontFamily", residueFontFamily)
  // console.log("scrollbarSize", scrollbarSize)
  // console.log("alignmentColorPalette", alignmentColorPalette)
  // console.log("alignmentColorMode", alignmentColorMode)
  // console.log("positionsToStyle", positionsToStyle)
  // console.log("highlightCurrentSequence", highlightCurrentSequence)

  const firstRenderRef = useRef(true)

  const {
    className,
    style,
    showColumns = [],
    pinnedColumns = [], // ["id"],
    collapsedGroups = [],
    zoom = 12,
    isOverviewMode = false,
    toggles = defaultAlignmentViewerToggles,
    fontFamily = "sans-serif",
    residueFontFamily = "monospace",
    scrollbarSize = 10,
    // alignmentColorPalette = {Dark: new Map<string, TColorEntry>(), Light: new Map<string, TColorEntry>()},
    // alignmentColorMode = alignmentColorModes[0],
    // positionsToStyle = "all",
    highlightCurrentSequence = false,
    colorTheme,
    onMouseHover,
    onSortActionIconClick,
    onExpandCollapseGroupIconClick,
    onExpandCollapseAllGroupsIconClick,
    onContextMenu,
    onBusy, 
  } = alignmentViewerProps

  // parent states for derived states
  const propsAlignment = alignmentViewerProps.alignment
  const [alignment, setAlignment] = useState(propsAlignment)

  // const propsReferenceSequenceIndex = alignmentViewerProps.referenceSequenceIndex ?? 0
  
  const propsSortBy = useMemo(() => (alignmentViewerProps.sortBy ?? []), [alignmentViewerProps.sortBy])
  const [sortBy, setSortBy] = useState<TAlignmentSortParams[]>([])

  const propsAlignmentColorPalette = useMemo(() => (alignmentViewerProps.alignmentColorPalette ?? {
    Dark: new Map<string, TColorEntry>(), 
    Light: new Map<string, TColorEntry>()
  }), [alignmentViewerProps.alignmentColorPalette])
  const [alignmentColorPalette, setAlignmentColorPalette] = useState(propsAlignmentColorPalette)

  const propsAlignmentColorMode = alignmentViewerProps.alignmentColorMode ?? alignmentColorModes[0]
  const [alignmentColorMode, setAlignmentColorMode] = useState(propsAlignmentColorMode)
  
  const propsPositionsToStyle = alignmentViewerProps.positionsToStyle ?? "all"
  const [positionsToStyle, setPositionsToStyle] = useState(propsPositionsToStyle)

  const s2Ref = useRef<AVTableSheet>(null)
  const adaptiveRef = useRef<HTMLDivElement>(null)

  const iconSize = 10
  const iconMarginLeft = 4
  const iconMarginRight = 0

  const dimensions: TDimensions = useDimensions(alignment, isOverviewMode, fontFamily, residueFontFamily, zoom)

  const [columns, pinnedColumnsCount] = useMemo(() => {
    const shownFields: string[] = []
    let pinnedColumnsCount = 0

    if (!isOverviewMode) {
      const availableFields = []
      for (const field of Object.keys(alignment.annotationFields)) {
        if (!HIDDEN_ANNOTATION_FIELDS.includes(field)) {
          availableFields.push(field)
        }
      }

      for (const field of pinnedColumns) {
        if (availableFields.includes(field) && !shownFields.includes(field)) {
          shownFields.push(field)
        }
      }
      pinnedColumnsCount = shownFields.length

      for (const field of showColumns) {
        if (availableFields.includes(field) && !shownFields.includes(field)) {
          shownFields.push(field)
        }
      }  
    }

    shownFields.push("__sequenceIndex__")
    shownFields.push("$$minimap$$")

    return [shownFields, pinnedColumnsCount]
  }, [alignment.annotationFields, showColumns, pinnedColumns, isOverviewMode])

  // const handleActionIconClick = useCallback((event: CanvasEvent) => {
  const handleSortActionIconClick = useCallback((props: HeaderIconClickParams) => {
    const { iconName, meta: node, event } = props
    s2Ref.current?.interaction.reset()
    // console.log(iconName, node, event)
    onSortActionIconClick?.(node.field)
  }, [s2Ref, onSortActionIconClick])

  // console.log("setS2ThemeCfg EFFECT", dimensions, scrollbarSize, highlightCurrentSequence)
  const s2ThemeCfg = useS2ThemeCfg(
    fontFamily,
    dimensions,
    iconSize,
    iconMarginLeft,
    iconMarginRight,
    scrollbarSize,
    highlightCurrentSequence,
    colorTheme,
  )

  // const sortedIndices = useMemo(() => (sortAlignment(alignment, sortBy)), [alignment, sortBy])
  const [sortedIndices, setSortedIndices] = useState<number[]>(range(0, alignment.depth))
  const [minimapImage, setMinimapImage] = useState<OffscreenCanvas>()
  useEffect(() => {
    async function asyncUpdate() {
      onBusy?.(true)

      let _sortedIndices: number[]
      if ((propsAlignment === alignment) && (propsSortBy === sortBy)) {
        _sortedIndices = sortedIndices
      } else {
        console.log("begin sort", sortedIndices.slice(0, 5))
        const worker = new Worker(new URL('../workers/sortAlignment.ts', import.meta.url), { type: 'module' })
        const remoteSortAlignment = await spawn(worker)
        _sortedIndices = await remoteSortAlignment(propsAlignment, propsSortBy)
        await Thread.terminate(remoteSortAlignment)
        console.log("end sort", _sortedIndices.slice(0, 5))
      }

      if (
        firstRenderRef.current ||
        (propsAlignment !== alignment) || 
        (propsSortBy !== sortBy) || 
        (propsPositionsToStyle !== positionsToStyle) || 
        (propsAlignmentColorPalette !== alignmentColorPalette) || 
        (propsAlignmentColorMode !== alignmentColorMode)
      ) {
        const worker = new Worker(new URL('../workers/createMinimapImage.ts', import.meta.url), { type: 'module' })
        const remoteCreateMinimapImage = await spawn(worker)
        const { width, height, buffer }  = await remoteCreateMinimapImage(
          propsAlignment, 
          _sortedIndices, 
          propsPositionsToStyle, 
          propsAlignmentColorPalette, 
          propsAlignmentColorMode,
        )
        await Thread.terminate(remoteCreateMinimapImage)
  
        // console.log("minimap", _sortedIndices.slice(0, 5))
        const imageData = new ImageData(new Uint8ClampedArray(buffer), width, height)
        const newMinimapImage = new OffscreenCanvas(width, height)
        const ctx = newMinimapImage.getContext("2d")
        ctx?.putImageData(imageData, 0, 0)
  
        // console.log("set alignment", alignment.uuid.substring(0, 4), "->", propsAlignment.uuid.substring(0, 4))
        if ((propsAlignment.uuid !== alignment.uuid) && s2Ref.current?.options.style?.colCfg?.widthByFieldValue) {
          s2Ref.current.options.style.colCfg.widthByFieldValue = undefined
        }
        setAlignment(propsAlignment)
        setSortBy(propsSortBy)  
        setSortedIndices(_sortedIndices)

        setPositionsToStyle(propsPositionsToStyle)
        setAlignmentColorPalette(propsAlignmentColorPalette)
        setAlignmentColorMode(propsAlignmentColorMode)
        setMinimapImage(newMinimapImage)
      }

      onBusy?.(false)
    }
    asyncUpdate()
  }, [
    propsAlignment, 
    alignment,
    propsSortBy,
    sortBy,
    sortedIndices,
    propsPositionsToStyle, 
    positionsToStyle,
    propsAlignmentColorPalette, 
    alignmentColorPalette,
    propsAlignmentColorMode,
    alignmentColorMode,
    onBusy,
  ])

  const sortedDisplayedIndices: number[] = useMemo(() => {
    if (alignment.groupBy === undefined) {
      return [...sortedIndices]
    }

    const sortedDisplayedIndices: number[] = []
    const shouldDisplay: boolean[] = new Array(alignment.groups.length).fill(true)
    for (const sequenceIndex of sortedIndices) {
      const groupIndex = alignment.sequences[sequenceIndex].__groupIndex__
      if (collapsedGroups.includes(groupIndex)) {
        if (shouldDisplay[groupIndex]) {
          sortedDisplayedIndices.push(sequenceIndex)
          shouldDisplay[groupIndex] = false
        }
      } else {
        sortedDisplayedIndices.push(sequenceIndex)
      }
    }
    return sortedDisplayedIndices
  }, [
    sortedIndices, 
    collapsedGroups, 
    alignment.groupBy,
    alignment.sequences, 
    alignment.groups.length
  ])

  const {
    s2DataCfg, 
    firstResidueColIndex, 
    firstSequenceRowIndex
  } = useS2DataCfg(alignment, sortedDisplayedIndices, columns, isOverviewMode)

  const rowHeightsByField = useMemo(() => {
    let i = 0
    const heights: Record<string, number> = {}

    for (const key of Object.keys(SPECIAL_ROWS) as Array<keyof typeof SPECIAL_ROWS>) {
      heights[`${i}`] = toggles[key].visible ? Math.ceil(SPECIAL_ROWS[key].height * dimensions.rowHeight) + dimensions.paddingTop + dimensions.paddingBottom : 0
      ++i
    }

    if (alignment.groupBy !== undefined) {
      for (const sequenceIndex of sortedDisplayedIndices) {
        const groupIndex = alignment.sequences[sequenceIndex].__groupIndex__
        if (collapsedGroups.includes(groupIndex)) {
          heights[`${i}`] = Math.ceil(SEQUENCE_LOGO_ROW_HEIGHT_RATIO * dimensions.rowHeight) + dimensions.paddingTop + dimensions.paddingBottom
        }
        ++i
      }  
    }

    return heights
  }, [
    toggles, 
    collapsedGroups, 
    sortedDisplayedIndices,
    alignment.groupBy, 
    alignment.sequences,
    dimensions,
  ])


  const columnWidthsRef = useRef<TColumnWidths>({
    alignmentUuid: alignment.uuid,
    isGrouped: !!alignment.groupBy,
    fieldWidths: {},
    isResizing: false,
  })

  // console.log("setS2Options EFFECT", dimensions, highlightCurrentSequence)
  const showMinimap = toggles["$$MiniMap$$"].visible
  const s2Options = useS2Options(
    window.devicePixelRatio,
    alignment,
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
    scrollbarSize,
    showMinimap, 
    rowHeightsByField, 
    highlightCurrentSequence, 
    handleSortActionIconClick, 
  )
  
  // work around a bug in antv/s2 re merging options
  useMemo(() => {
    if (!!s2Ref.current?.options?.style?.rowCfg) {
      s2Ref.current.options.style.rowCfg.heightByField = s2Options.style?.rowCfg?.heightByField
    }  
  }, [s2Ref, s2Options.style?.rowCfg?.heightByField])

  // useMemo(() => {
  //   if (!!s2Ref.current?.options?.style?.colCfg) {
  //     s2Ref.current.options.style.colCfg.widthByFieldValue = s2Options.style?.colCfg?.widthByFieldValue
  //   }  
  // }, [s2Ref, s2Options.style?.colCfg?.widthByFieldValue])

  const sequenceLogosCommonProps = useMemo(() => {
    const logoHeight = rowHeightsByField[`${Object.keys(SPECIAL_ROWS).indexOf("$$sequence logo$$")}`] - dimensions.paddingTop - dimensions.paddingBottom
    let compareToSequence: string = ""
    switch (positionsToStyle) {
      case "sameAsReference":
      case "differentFromReference":
        compareToSequence = alignment.referenceSequence?.sequence
        break
      case "sameAsConsensus":
      case "differentFromConsensus":
        compareToSequence = alignment.consensusSequence?.sequence
        break
      default:
        compareToSequence = ""
    }

    return {
      alphabet: alignment.alphabet,
      width: dimensions.residueWidth,
      height: logoHeight,
      fontSize: dimensions.fontSize,
      fontFamily: residueFontFamily,
      fontWidth: dimensions.residueFontWidth,
      fontActualBoundingBoxAscents: dimensions.residueFontActualBoundingBoxAscents,
      fontActualBoundingBoxDescents: dimensions.residueFontActualBoundingBoxDescents,
      colorPalette: (alignmentColorMode === "Dark") ? alignmentColorPalette["Light"] : alignmentColorPalette["Dark"],
      defaultTextColor: colorTheme.text, 
      backgroundColor: colorTheme.backgroundAlt,
      compareToSequence,
      positionsToStyle: positionsToStyle,
    }
  }, [
    alignment.alphabet,
    alignment.referenceSequence,
    alignment.consensusSequence,
    dimensions, 
    colorTheme.text, 
    colorTheme.backgroundAlt,
    alignmentColorPalette, 
    alignmentColorMode, 
    positionsToStyle, 
    residueFontFamily, 
    rowHeightsByField,
  ])
  
  const sequenceLogos = useMemo(() => (
    new SequenceLogos({
      pssm: alignment.pssm,
      pssmSortedIndices: alignment.pssmSortedIndices,
      ...sequenceLogosCommonProps,
    })
  ), [
    alignment.pssm, 
    alignment.pssmSortedIndices,
    sequenceLogosCommonProps,
  ])

  const sequenceLogosGroups = useMemo(() => (
    new SequenceLogosGroups({
      groups: alignment.groups,
      ...sequenceLogosCommonProps
    })
  ), [
    alignment.groups,
    sequenceLogosCommonProps
  ])

  const sprites = useMemo(() => {
    return new Sprites({
      alphabet: alignment.alphabet,
      width: dimensions.residueWidth, 
      height: dimensions.rowHeight + dimensions.paddingTop + dimensions.paddingBottom, 
      font: `${dimensions.fontSize}px ${residueFontFamily}`,
      fontActualBoundingBoxAscents: dimensions.residueFontActualBoundingBoxAscents,
      fontActualBoundingBoxDescents: dimensions.residueFontActualBoundingBoxDescents,
      // textColor: alignmentColorMode === "Letter Only" ? alignmentColorPalette["Dark"] : colorTheme.text,
      textColor: alignmentColorMode === "Dark" ? alignmentColorPalette["Light"] : alignmentColorPalette["Dark"],
      defaultTextColor: colorTheme.text,
      // backgroundColor: alignmentColorMode === "Letter Only" ? colorTheme.background : alignmentColorPalette["Light"],
      backgroundColor: (alignmentColorMode === "Letter Only") ? colorTheme.background : (alignmentColorMode === "Light") ? alignmentColorPalette["Light"] : alignmentColorPalette["Dark"],
      defaultBackgroundColor: colorTheme.background,
      isOverviewMode,
    })
  }, [alignment.alphabet, dimensions, residueFontFamily, colorTheme.text, colorTheme.background, alignmentColorPalette, alignmentColorMode, isOverviewMode])

  const barSprites = useMemo(() => {
    const maxBarHeight = rowHeightsByField[`${Object.keys(SPECIAL_ROWS).indexOf("$$coverage$$")}`] - dimensions.paddingTop - dimensions.paddingBottom
    return new BarSprites({
      width: dimensions.residueFontWidth,
      height: maxBarHeight,
      barColor: "#9da7b6", // this.spreadsheet.theme.dataCell.text.fill
      backgroundColor: colorTheme.background,
    })
  }, [
    rowHeightsByField, 
    dimensions.paddingTop, 
    dimensions.paddingBottom, 
    dimensions.residueFontWidth, 
    colorTheme.background
  ])

  const initAVStore = useCallback((s2: AVTableSheet | null) => {
    // console.log("update av store")
    if (!s2) {
      // console.log("s2 is nil")
      return
    }
  
    s2.avStore.set("zoom", zoom)
    s2.avStore.set("isOverviewMode", isOverviewMode)
    s2.avStore.set("residueFontFamily", residueFontFamily)
    s2.avStore.set("dimensions", dimensions)
    s2.avStore.set("alignmentColorMode", alignmentColorMode)
    s2.avStore.set("alignmentColorPalette", alignmentColorPalette)
    s2.avStore.set("positionsToStyle", positionsToStyle)
    s2.avStore.set("sprites", sprites)
    s2.avStore.set("alignment", alignment)
    s2.avStore.set("collapsedGroups", collapsedGroups)
    s2.avStore.set("sortedDisplayedIndices", sortedDisplayedIndices)
    s2.avStore.set("firstResidueColIndex", firstResidueColIndex)
    s2.avStore.set("firstSequenceRowIndex", firstSequenceRowIndex)
    s2.avStore.set("showMinimap", showMinimap)
    s2.avStore.set("minimapImage", minimapImage)
    s2.avStore.set("sequenceLogos", sequenceLogos)
    s2.avStore.set("sequenceLogosGroups", sequenceLogosGroups)
    s2.avStore.set("barSprites", barSprites)
    s2.avStore.set("visibleSequencePositionStart", -1)
    s2.avStore.set("visibleSequencePositionEnd", -1)
    s2.avStore.set("visibleSequenceIndexStart", -1)
    s2.avStore.set("visibleSequenceIndexEnd", -1)
  }, [
    zoom, 
    isOverviewMode, 
    residueFontFamily, 
    dimensions, 
    alignmentColorMode, 
    alignmentColorPalette, 
    positionsToStyle, 
    sprites, 
    alignment, 
    collapsedGroups,
    sortedDisplayedIndices, 
    firstSequenceRowIndex, 
    firstResidueColIndex, 
    showMinimap, 
    minimapImage, 
    sequenceLogos, 
    sequenceLogosGroups, 
    barSprites, 
  ])

  /*
  useMemo(() => {
    // console.log("initAVStore")
    initAVStore(s2Ref.current)
  }, [initAVStore, s2Ref])
  */

  // const [, forceUpdate] = useState({})
  // useEffect(() => {
  //   // console.log("s2Ref changed", s2Ref.current?.id)
  //   window.s2 = s2Ref.current
  //   updateAVStore()
  //   // forceUpdate({})
  // }, [s2Ref, updateAVStore, forceUpdate])

  const handleCellIconClick = useCallback(({ event, target, viewMeta, iconName }: TTargetCellAndIconInfo) => {
    if ((target.cellType === "colCell") && (viewMeta.field === SERIES_NUMBER_FIELD)) {
      onExpandCollapseAllGroupsIconClick?.()
    } else if ((target.cellType === "rowCell") && (viewMeta.valueField === SERIES_NUMBER_FIELD)) {
      const i = viewMeta.rowIndex - firstSequenceRowIndex
      if (i < 0) {
        return
      }
      const groupIndex = alignment.sequences[sortedDisplayedIndices[i]].__groupIndex__
      // console.log(groupIndex)
      onExpandCollapseGroupIconClick?.(groupIndex)
    }
  }, [
    firstSequenceRowIndex,
    sortedDisplayedIndices,
    alignment.sequences,
    onExpandCollapseAllGroupsIconClick,
    onExpandCollapseGroupIconClick
  ])

  const handleMounted = useCallback((s2: SpreadSheet) => {
    // console.log("mounted", s2?.id)
    initAVStore(s2 as AVTableSheet)
    window.s2 = s2
  }, [initAVStore])

  const handleLayoutResizeColWidth = useCallback((params: ResizeParams) => {
    columnWidthsRef.current.isResizing = true
  }, [])

  const handleLayoutAfterHeaderLayout = useCallback((layoutResult: LayoutResult) => {
    columnWidthsRef.current.isResizing = false
    columnWidthsRef.current.isGrouped = !!alignment.groupBy
    if (columnWidthsRef.current.alignmentUuid !== alignment.uuid) {
      columnWidthsRef.current.alignmentUuid = alignment.uuid
      columnWidthsRef.current.fieldWidths = {}
    }

    for (const node of layoutResult.colLeafNodes) {
      columnWidthsRef.current.fieldWidths[node.field] = node.width
    }
  }, [alignment.uuid, alignment.groupBy])

  const handleDataCellHover = useCallback((data: TargetCellInfo): void => {
    if (!onMouseHover) {
      return
    }
    const { event, target, viewMeta, iconName } = getTargetCellInfo(data)
    let info = target.getContextualInfo?.(event, target, viewMeta, iconName)
    if (isNil(info.sequenceId) && (info.content.length === 0)) {
      info = undefined
    }
    onMouseHover(info)
  }, [onMouseHover])

  const handleNoContextualInfo = useCallback(() => {
    onMouseHover?.()
  }, [onMouseHover])

  const handleDataCellClick = useCallback((data: TargetCellInfo) => {
    // console.log("colHeight", dimensions.colHeight)
    // console.log('scrollOffset', s2Ref.current.facet.getScrollOffset())
    // console.log('frozenColGroup clip', s2Ref.current.frozenColGroup.getClip().getBBox())
    // console.log('frozenRowGroup clip', s2Ref.current.frozenRowGroup.getClip().getBBox())
    // console.log('panelScrollGroup', s2Ref.current.panelScrollGroup.getBBox())
    // console.log('panelScrollGroup clip', s2Ref.current.panelScrollGroup.getClip().getBBox())

    const { event, target, viewMeta, iconName } = getTargetCellInfo(data)
    target.onClick?.(event, target, viewMeta, iconName)
    // console.log("data clicked")
  }, [])

  const handleRowCellClick = handleDataCellClick

  const targetRowCellWhenMouseDownRef = useRef<S2CellType | null>(null)
  
  const handleRowCellMouseDown = useCallback((data: TargetCellInfo): void => {
    const { event, target, viewMeta, iconName } = getTargetCellInfo(data)
    if (iconName) {
      targetRowCellWhenMouseDownRef.current = target
    }
  }, [targetRowCellWhenMouseDownRef])

  const handleRowCellMouseUp = useCallback((data: TargetCellInfo): void => {
    const { event, target, viewMeta, iconName } = getTargetCellInfo(data)
    if (iconName && (target === targetRowCellWhenMouseDownRef.current)) {
      // handleRowCellClick(data)
      targetRowCellWhenMouseDownRef.current = null
      handleCellIconClick({ event, target, viewMeta, iconName })
    }
  }, [handleCellIconClick])

  const handleContextMenu = useCallback((event: CanvasEvent) => {
    // const { event, target, viewMeta, iconName } = getTargetCellInfo(data)
    // console.log(event)
    // getTargetCellInfo(event)
    const target = s2Ref.current?.getCell(event.target) as S2CellType
    const viewMeta = target?.getMeta() as S2Node
    let data
    if ((viewMeta?.valueField === "__sequenceIndex__") && (viewMeta?.fieldValue === "$$overview$$")) {
      // console.log(event.y, scrollY, viewMeta.y, dimensions.colHeight)
      const facet = s2Ref.current?.facet
      if (facet) {
        const { scrollX = 0, scrollY = 0 } = facet.getScrollOffset()
        const row = Math.floor((event.y - facet?.columnHeader.getBBox().height + scrollY - viewMeta.y) / dimensions.residueHeight)
        const sequenceIndex = sortedDisplayedIndices[row]
        data = alignment.sequences[sequenceIndex]
      }
    } else {
      data = s2Ref.current?.dataSet.getCellData({
        query: {
          rowIndex: viewMeta?.rowIndex
        }
      })  
    }
    onContextMenu?.({event, target, viewMeta, data})
  }, [s2Ref, alignment.sequences, dimensions, sortedDisplayedIndices, onContextMenu])

  const handleSelected = useCallback((cells: S2CellType[]) => {
    s2Ref.current?.interaction.reset()
  }, [s2Ref])

  const handleBeforeRender = useCallback(() => {
    // console.log("***before render***")
    onBusy?.(true)
  }, [onBusy])

  const handleAfterRender = useCallback(() => {
    // console.log("***after render***")
    onBusy?.(false)
  }, [onBusy])

  const handleDestroy = useCallback(() => {
    // console.log("destroy")
  }, [])

  const adaptiveProp = useMemo(() => ({
    width: true, 
    height: true, 
    getContainer: () => (adaptiveRef.current as HTMLElement)
  }), [])


  const memoizedSheetComponent = useMemo(() => {
    initAVStore(s2Ref.current)
    return (
      <SheetComponent
        // key={renderKey}
        ref={s2Ref}
        sheetType="table" // 此处指定sheetType为editable
        spreadsheet={spreadsheet}
        dataCfg={s2DataCfg}
        options={s2Options}
        themeCfg={s2ThemeCfg}
        adaptive={adaptiveProp}
        // onClick={handleRowCellClick}
        // onActionIconClick={handleActionIconClick}
        onDataCellClick={handleDataCellClick}
        // SeriesCell is RowCell
        onRowCellClick={handleRowCellClick}
        // S2 does not emit click event for RowCell icons
        // So we have to manually examine the mouseup/mousedown events
        onRowCellMouseDown={handleRowCellMouseDown}
        onRowCellMouseUp={handleRowCellMouseUp}
        onRowCellHover={handleNoContextualInfo}
        onColCellMouseDown={handleRowCellMouseDown}
        onColCellMouseUp={handleRowCellMouseUp}
        onColCellHover={handleNoContextualInfo}
        onContextMenu={handleContextMenu}
        onDataCellHover={handleDataCellHover}
        onCornerCellHover={handleNoContextualInfo}
        onSelected={handleSelected}
        onBeforeRender={handleBeforeRender}
        onAfterRender={handleAfterRender}
        onMounted={handleMounted}
        onDestroy={handleDestroy}
        onLayoutAfterHeaderLayout={handleLayoutAfterHeaderLayout}
        onLayoutResizeColWidth={handleLayoutResizeColWidth}
      />
    )
  }, [
    initAVStore,
    s2Ref,
    s2DataCfg,
    s2Options,
    s2ThemeCfg,
    adaptiveProp,
    handleDataCellClick,
    handleRowCellClick,
    handleRowCellMouseDown,
    handleRowCellMouseUp,
    handleContextMenu,
    handleDataCellHover,
    handleNoContextualInfo,
    handleSelected,
    handleBeforeRender,
    handleAfterRender,
    handleMounted,
    handleDestroy,
    handleLayoutAfterHeaderLayout,
    handleLayoutResizeColWidth,
  ])

  // force s2 to re-render when only avStore changes but no props to SheetComponent change
  const sheetComponentPropsChangedRef = useRef(false)
  sheetComponentPropsChangedRef.current = false
  useEffect(() => {
    sheetComponentPropsChangedRef.current = true
  }, [s2DataCfg, s2Options, s2ThemeCfg])

  useEffect(() => {
    if (!sheetComponentPropsChangedRef.current) {
      s2Ref.current?.render(false, { reBuildDataSet: false, reBuildHiddenColumnsDetail: false, reloadData: false})
    }
  })


  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false
    }
  }, [])

  return (
    <div 
      className={clsx("av-wrapper", className)} 
      style={style}
      ref={adaptiveRef} 
      onMouseLeave={handleNoContextualInfo} 
    >
      {firstRenderRef.current || memoizedSheetComponent}
    </div>
  )
}

