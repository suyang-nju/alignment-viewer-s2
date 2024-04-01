import type {
  S2DataConfig, 
  S2Options, 
  S2MountContainer, 
  TargetCellInfo, 
  LayoutResult, 
  ResizeParams,
  SpreadSheet, 
  ViewMeta, 
  S2CellType, 
  HeaderIconClickParams, 
} from '@antv/s2'
import type { Event as CanvasEvent } from '@antv/g-canvas'
import type { SheetComponentOptions } from '@antv/s2-react'

import type {
  TColumnWidths, 
  TAVExtraOptions,
  TAlignment, 
  TAlignmentAnnotations, 
  TSequenceAnnotationFields,
  TAlignmentSortParams, 
  TAlignmentViewerToggles,
  TContextualInfo,
  TAVMouseEventInfo,
  TDimensions,
  TAlignmentViewerProps,
  TAlignmentPositionsToStyle, 
} from '../lib/types'

import {
  AVTableSheet, 
  useS2Options, 
  useS2ThemeCfg, 
  useS2DataCfg, 
} from '../lib/AVTableSheet'
import {
  SPECIAL_ROWS, 
  ALIGNMENT_COLOR_MODES,
  SEQUENCE_LOGO_ROW_HEIGHT_RATIO,
  SEQUENCE_LOGO_BAR_STACK_ZOOM,
} from '../lib/constants'
import Sprites from '../lib/sprites'
import BarSprites from '../lib/BarSprites'
import { ObjectPool } from "../lib/objectPool"
import { useSequenceLogos } from '../lib/sequenceLogos'
import { alignmentColorSchema } from '../lib/AlignmentColorSchema'
import { getObjectKeys } from '../lib/utils'
import { getAlignmentAnnotationFields } from '../lib/alignment'

import clsx from 'clsx'
import { spawn, Thread, Worker } from 'threads'
// const { spawn, Thread, Worker } = require('threads')

import { useRef, useMemo, useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react'
import {
  Node as S2Node, 
  GuiIcon, 
  SERIES_NUMBER_FIELD, 
  CellTypes, 
} from '@antv/s2'
import { SheetComponent } from '@antv/s2-react'
import '@antv/s2-react/dist/style.min.css'


declare global {
  interface Window {
    s2: AVTableSheet
  }
}

const defaultAlignmentViewerToggles = {} as TAlignmentViewerToggles
for (const [k, v] of Object.entries(SPECIAL_ROWS)) {
  defaultAlignmentViewerToggles[k] = {label: v.label, visible: v.defaultVisible}
}
defaultAlignmentViewerToggles["$$MiniMap$$"] = {label: "MiniMap", visible: true}
export { defaultAlignmentViewerToggles }

// eslint-disable-next-line  @typescript-eslint/no-explicit-any
function useChangeDetector(prompt: string, ...args: any[]) {
  useEffect(() => { console.log(prompt) }, [prompt, ...args])
}

function useDimensions(
  alignment: TAlignment | null,
  isOverviewMode: boolean,
  fontFamily: string, 
  residueFontFamily: string,
  zoom: number,
): TDimensions {
  return useMemo(() => {
    const iconSize = zoom
    const iconMarginLeft = zoom / 2
    const iconMarginRight = 0
    const minMinimapWidth = 20, maxMinimapWidth = 120, minimapMargin = 4
    const emptyResult =  {
      zoom,
      fontFamily,
      residueFontFamily,
      fontSize: zoom,
      regularTextHeight: 0,
      residueFontWidth: 0, 
      residueFontHeight: 0, 
      residueFontActualBoundingBoxAscents: {}, 
      residueFontActualBoundingBoxDescents: {},
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
      iconSize,
      iconMarginLeft,
      iconMarginRight,
    }

    if (!alignment?.alphabet) {
      return emptyResult
    }

    const canvas = new OffscreenCanvas(0, 0)
    const ctx = canvas.getContext("2d")
    if (!ctx) {
      // console.log("Dimension EFFECT null")
      return emptyResult
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

      const residueFontActualBoundingBoxAscents: Record<string, number> = {}
      const residueFontActualBoundingBoxDescents: Record<string, number> = {}
      for (const char of alignment.alphabet) {
        residueFontActualBoundingBoxAscents[char] = zoom
        residueFontActualBoundingBoxDescents[char] = 0
      }

      for (const char of alignment.pssmAlphabet) {
        if (!(char in residueFontActualBoundingBoxAscents)) {
          residueFontActualBoundingBoxAscents[char] = zoom
          residueFontActualBoundingBoxDescents[char] = 0
        }
      }

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
        iconSize,
        iconMarginLeft,
        iconMarginRight,
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

    const residueFontActualBoundingBoxAscents: Record<string, number> = {}
    const residueFontActualBoundingBoxDescents: Record<string, number> = {}
    for (const char of alignment.alphabet) {
      residueTextMetrics = ctx.measureText(char)
      residueFontActualBoundingBoxAscents[char] = residueTextMetrics.actualBoundingBoxAscent
      residueFontActualBoundingBoxDescents[char] = residueTextMetrics.actualBoundingBoxDescent
      const h = residueTextMetrics.actualBoundingBoxAscent + residueTextMetrics.actualBoundingBoxDescent
      if (h > residueFontHeight) {
        residueFontHeight = h
      }
    }

    for (const char of alignment.pssmAlphabet) {
      if (!(char in residueFontActualBoundingBoxAscents)) {
        residueTextMetrics = ctx.measureText(char)
        residueFontActualBoundingBoxAscents[char] = residueTextMetrics.actualBoundingBoxAscent
        residueFontActualBoundingBoxDescents[char] = residueTextMetrics.actualBoundingBoxDescent  
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
      iconSize,
      iconMarginLeft,
      iconMarginRight,
    }
  }, [
    zoom, 
    isOverviewMode, 
    alignment?.alphabet, 
    alignment?.pssmAlphabet, 
    alignment?.depth, 
    alignment?.length, 
    fontFamily, 
    residueFontFamily
  ])
}

function getAVMouseEventInfo(data: TargetCellInfo): TAVMouseEventInfo {
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
  const contextualInfo: TContextualInfo = target?.getContextualInfo?.(event, target, viewMeta, iconName)

  return { event, target, viewMeta, iconName, contextualInfo }
}

export default forwardRef(function AlignmentViewer(alignmentViewerProps: TAlignmentViewerProps, ref) {
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

  const {
    className,
    style,
    // referenceSequenceIndex: propsReferenceSequenceIndex = 0,
    // groupBy: propsGroupBy,
    zoom = 12,
    isOverviewMode = false,
    toggles = defaultAlignmentViewerToggles,
    fontFamily = "sans-serif",
    residueFontFamily = "monospace",
    scrollbarSize = 10,
    // alignmentColorPalette = {Dark: new Map<string, TColorEntry>(), Light: new Map<string, TColorEntry>()},
    alignmentColorMode = ALIGNMENT_COLOR_MODES[0],
    // positionsToStyle = "all",
    hideUnstyledPositions = false,
    highlightCurrentSequence = true,
    colorTheme,
    adaptiveContainerRef,
    onLoadAlignment,
    onChangeAlignment,
    onChangeSortBy,
    onChangePinnedColumns,
    onChangeOtherVisibleColumns,
    onMouseHover,
    onContextMenu,
    onBusy,
  } = alignmentViewerProps

  const [fileOrUrl, setFileOrUrl] = useState<File | string | undefined>(undefined)
  const [alignment, setAlignment] = useState<TAlignment | undefined>(undefined)
  const [pinnedColumns, setPinnedColumns] = useState<string[]>([]) // ["__id__"]
  const [otherVisibleColumns, setOtherVisibleColumns] = useState<string[]>([])
  const [collapsedGroups, setCollapsedGroups] = useState<number[]>([])
  const [sortBy, setSortBy] = useState<TAlignmentSortParams[]>([])
  const [alignmentColorPalette, setAlignmentColorPalette] = useState(alignmentColorSchema[getObjectKeys(alignmentColorSchema)[0]])
  const [darkMode, setDarkMode] = useState(false)
  const [positionsToStyle, setPositionsToStyle] = useState<TAlignmentPositionsToStyle>("all")

  useImperativeHandle(ref, () => ({
    updateAnnotations(updatedAnnotations: TAlignmentAnnotations, updatedAnnotationFields: TSequenceAnnotationFields) {
      if (!alignment) {
        return
      }

      const newlyAddedColumns: string[] = []
      for (const field of Object.keys(updatedAnnotationFields)) {
        if (!(field in alignment.annotationFields)) {
          newlyAddedColumns.push(field)
        }
      }

      const newAlignment: TAlignment = {
        ...alignment,
        annotations: updatedAnnotations,
        annotationFields: updatedAnnotationFields,
      }

      setAlignment(newAlignment)
      onChangeAlignment?.(newAlignment)
      if (newlyAddedColumns.length > 0) {
        const newOtherVisibleColumns = [...otherVisibleColumns, ...newlyAddedColumns]
        setOtherVisibleColumns(newOtherVisibleColumns)
        onChangeOtherVisibleColumns?.(newOtherVisibleColumns)
      }
    }
  }), [alignment, otherVisibleColumns, onChangeAlignment, onChangeOtherVisibleColumns])

  const s2Ref = useRef<AVTableSheet>(null)

  const dimensions: TDimensions = useDimensions(alignment, isOverviewMode, fontFamily, residueFontFamily, zoom)

  const [columns, pinnedColumnsCount] = useMemo(() => {
    const shownFields: string[] = []
    let pinnedColumnsCount = 0

    if (alignment?.annotationFields && !isOverviewMode) {
      for (const field of pinnedColumns) {
        shownFields.push(field)
      }
      pinnedColumnsCount = shownFields.length

      for (const field of otherVisibleColumns) {
        shownFields.push(field)
      }  
    }

    shownFields.push("__sequenceIndex__")
    shownFields.push("$$minimap$$")

    return [shownFields, pinnedColumnsCount]
  }, [alignment?.annotationFields, otherVisibleColumns, pinnedColumns, isOverviewMode])

  const collapsibleGroups = useMemo(() => {
    if (alignment?.groups.length) {
      const collapsibleGroups = []
      for (let groupIndex = 0; groupIndex < alignment.groups.length; ++groupIndex) {
        if (alignment.groups[groupIndex].members.length > 1) {
          collapsibleGroups.push(groupIndex)
        }
      }
      return collapsibleGroups
    } else {
      return []
    }
  }, [alignment?.groups])


  const handleSortActionIconClick = useCallback((field: string) => {
    let newSortBy: TAlignmentSortParams[]
    // cycle between "asc" and "desc"
    if ((sortBy.length !== 1) || (sortBy[0].field !== field) || (sortBy[0].order === "desc")) {
      newSortBy = [{field, order: "asc"}]
    } else { // sortBy[0].field === "asc"
      newSortBy = [{field, order: "desc"}]
    }
    
    // cycle through "asc", "desc" and unsorted
    // if ((sortBy.length !== 1) || (sortBy[0].field !== field)) {
    //   setSortBy([{field, order: "asc"}])
    // } else if (sortBy[0].order === "asc") {
    //   setSortBy([{field, order: "desc"}])
    // } else { // sortBy[0].field === "desc"
    //   setSortBy([])
    // }

    // console.log(newSortBy)
    // setSortBy(newSortBy)
    onChangeSortBy?.(newSortBy)
  }, [
    sortBy, 
    // setSortBy, 
    onChangeSortBy
  ])

  const handleExpandCollapseGroupIconClick = useCallback((groupIndex: number) => {
    if (collapsedGroups.includes(groupIndex)) {
      const newCollapsedGroups = []
      for (const i of collapsedGroups) {
        if (i !== groupIndex) {
          newCollapsedGroups.push(i)
        }
      }
      setCollapsedGroups(newCollapsedGroups)
    } else {
      setCollapsedGroups([...collapsedGroups, groupIndex])
    }
  }, [collapsedGroups, setCollapsedGroups])

  const handleExpandCollapseAllGroupsIconClick = useCallback(() => {
    if (
      (collapsibleGroups.length > 0) && 
      (collapsedGroups.length === collapsibleGroups.length)
    ) {
      setCollapsedGroups([])
    } else {
      setCollapsedGroups(collapsibleGroups)
    }
  }, [collapsibleGroups, collapsedGroups, setCollapsedGroups])


  // const handleActionIconClick = useCallback((event: CanvasEvent) => {
  const handleColHeaderActionIconClick = useCallback((props: HeaderIconClickParams) => {
    const { iconName, meta: node, event } = props
    // s2Ref.current?.interaction.reset()
    // console.log(iconName, node, event)
    if (iconName.startsWith("Sort")) {
      handleSortActionIconClick(node.field)
    }
  }, [handleSortActionIconClick])

  // console.log("setS2ThemeCfg EFFECT", dimensions, scrollbarSize, highlightCurrentSequence)
  const s2ThemeCfg = useS2ThemeCfg(
    fontFamily,
    dimensions,
    scrollbarSize,
    highlightCurrentSequence,
    colorTheme,
  )
  // useChangeDetector()
  // useChangeDetector("s2ThemeCfg changed", s2ThemeCfg)
  // useChangeDetector("- fontFamily changed", fontFamily)
  // useChangeDetector("- dimensions changed", dimensions)
  // useChangeDetector("- scrollbarSize changed", scrollbarSize)
  // useChangeDetector("- highlightCurrentSequence changed", highlightCurrentSequence)
  // useChangeDetector("- colorTheme changed", colorTheme)  

  // const sortedIndices = useMemo(() => (sortAlignment(alignment, sortBy)), [alignment, sortBy])
  const [sortedIndices, setSortedIndices] = useState<number[]>([])
  const [overviewImageData, setOverviewImageData] = useState<ImageData | undefined>(undefined)
  const [minimapImage, setMinimapImage] = useState<OffscreenCanvas>()
  const maxMinimapWidth = dimensions.maxMinimapWidth
  const maxMinimapHeight = window.innerHeight

  useEffect(() => {
    async function asyncUpdate() {
      // console.log("in async update")
      onBusy?.(true)

      // parent states for derived states
      const propsFileOrUrl = alignmentViewerProps.fileOrUrl
      let propsReferenceSequenceIndex = alignmentViewerProps.referenceSequenceIndex
      let propsPinnedColumns = alignmentViewerProps.pinnedColumns
      let propsOtherVisibleColumns = alignmentViewerProps.otherVisibleColumns
      let propsGroupBy = alignmentViewerProps.groupBy
      // let propsCollapsedGroups = alignmentViewerProps.collapsedGroups
      let propsSortBy = alignmentViewerProps.sortBy
      const propsAlignmentColorPalette = alignmentViewerProps.alignmentColorPalette ?? alignmentColorSchema[getObjectKeys(alignmentColorSchema)[0]]
      const propsDarkMode = alignmentViewerProps.darkMode ?? false
      const propsPositionsToStyle = alignmentViewerProps.positionsToStyle ?? "all"

      const tasks: Array<"setReference" | "group" | "sort" | "minimap"> = []
      let inputAlignment: TAlignment | undefined = undefined
      if (propsFileOrUrl && (propsFileOrUrl !== fileOrUrl)) {
        onLoadAlignment?.(undefined, true, false)

        const worker = await spawn(new Worker(new URL('../workers/fetchAlignment.ts', import.meta.url), { type: 'module' }))
        inputAlignment = await worker(propsFileOrUrl)
        await Thread.terminate(worker)

        if (!inputAlignment || inputAlignment.depth === 0) {
          inputAlignment = undefined
          onLoadAlignment?.(undefined, false, true)
        } else {
          onLoadAlignment?.(inputAlignment, false, false)

          if (propsReferenceSequenceIndex === undefined) {
            propsReferenceSequenceIndex = 0
          }

          if (propsPinnedColumns === undefined) {
            propsPinnedColumns = [] // ["__id__"]
          }

          if (propsOtherVisibleColumns === undefined) {
            const { importedFields } = getAlignmentAnnotationFields(inputAlignment)
            propsOtherVisibleColumns = importedFields.filter((col) => !propsPinnedColumns!.includes(col))
          }

          if (propsGroupBy === undefined) {
            propsGroupBy = false
          }
          
          // if (propsCollapsedGroups === undefined) {
          //   propsCollapsedGroups = []
          // }

          if (propsSortBy === undefined) {
            propsSortBy = []
          }
          
          tasks.push("setReference", "group", "sort")
        }
      } else if (alignment) {
        inputAlignment = alignment
        if ((propsReferenceSequenceIndex !== undefined) && (alignment.referenceSequenceIndex !== propsReferenceSequenceIndex)) {
          tasks.push("setReference")

          if (
            (propsGroupBy === "__hammingDistanceToReference__") || 
            (propsGroupBy === "__blosum62ScoreToReference__")
          ) {
            tasks.push("group")
          }

          if (propsSortBy !== undefined) {
            let shouldSort = false
            for (const by of propsSortBy) {
              if (
                (by.field === "__hammingDistanceToReference__") || 
                (by.field === "__blosum62ScoreToReference__")  
              ) {
                shouldSort = true
                break
              }
            }
  
            if (shouldSort) {
              tasks.push("sort")
            }
          }
        }

        if ((propsGroupBy !== undefined) && (alignment.groupBy !== propsGroupBy) && !tasks.includes("group")) {
          tasks.push("group", "sort")
        }

        if ((propsSortBy !== undefined) && (sortBy !== propsSortBy) && !tasks.includes("sort")) {
          tasks.push("sort")
        }
      }

      if (inputAlignment) {
        if (
          (tasks.includes("setReference") && ((propsPositionsToStyle === "sameAsReference") || (propsPositionsToStyle === "differentFromReference"))) || 
          (tasks.includes("sort")) ||
          (propsPositionsToStyle !== positionsToStyle) || 
          (propsAlignmentColorPalette !== alignmentColorPalette) || 
          (propsDarkMode !== darkMode)
        ) {
          tasks.push("minimap")
        }

        if (tasks.length > 0) {
          const worker = new Worker(new URL('../workers/updateAlignment.ts', import.meta.url), { type: 'module' })
          const remoteUpdateAlignment = await spawn(worker)
          const [
            outputAlignment, newSortedIndices, overviewBuffer, minimapBuffer, minimapImageWidth, minimapImageHeight
          ]: [TAlignment, number[], ArrayBuffer | undefined, ArrayBuffer | undefined, number | undefined, number | undefined] = await remoteUpdateAlignment(
            tasks,
            inputAlignment,
            sortedIndices,
            propsReferenceSequenceIndex,
            propsSortBy,
            propsGroupBy,
            propsPositionsToStyle,
            propsDarkMode ? propsAlignmentColorPalette["Dark"] : propsAlignmentColorPalette["Light"],
            maxMinimapWidth,
            maxMinimapHeight,
          )
          await Thread.terminate(remoteUpdateAlignment)
    
          const didSetReference = tasks.includes("setReference")
          const didGroup = tasks.includes("group")
          if (didSetReference || didGroup) {
            const newAlignment = {...inputAlignment}
            newAlignment.annotations = outputAlignment.annotations
            
            if (didSetReference) {
              newAlignment.referenceSequenceIndex = outputAlignment.referenceSequenceIndex
            }
    
            if (didGroup) {
              newAlignment.groupBy = outputAlignment.groupBy
              newAlignment.groups = outputAlignment.groups
            }
    
            setAlignment(newAlignment)
            console.log("new alignment for next render")
            onChangeAlignment?.(newAlignment)
          }
    
          if (didGroup || tasks.includes("sort")) {
            setSortedIndices(newSortedIndices)
            if ((propsSortBy !== undefined) && (sortBy !== propsSortBy)) {
              setSortBy(propsSortBy)
              onChangeSortBy?.(propsSortBy)
            }
          }
    
          if (tasks.includes("minimap")) {
            if (overviewBuffer) {
              const overviewImageWidth = outputAlignment.length
              const overviewImageHeight = outputAlignment.depth
              const overviewImageData = new ImageData(new Uint8ClampedArray(overviewBuffer), overviewImageWidth, overviewImageHeight)
              setOverviewImageData(overviewImageData)
              
              const minimapWidth = minimapImageWidth ?? overviewImageWidth
              const minimapHeight = minimapImageHeight ?? overviewImageHeight
              const newMinimapImage = new OffscreenCanvas(minimapWidth, minimapHeight)
              const ctx = newMinimapImage?.getContext("2d")
              if (minimapBuffer && minimapImageWidth && minimapImageHeight) {
                const minimapImageData = new ImageData(new Uint8ClampedArray(minimapBuffer), minimapImageWidth, minimapImageHeight)
                ctx?.putImageData(minimapImageData, 0, 0)
              } else {
                ctx?.putImageData(overviewImageData, 0, 0)
              }
              setMinimapImage(newMinimapImage)
            }
    
            if (propsPositionsToStyle !== positionsToStyle) {
              setPositionsToStyle(propsPositionsToStyle)
            }
            
            if (propsAlignmentColorPalette !== alignmentColorPalette) {
              setAlignmentColorPalette(propsAlignmentColorPalette)
            }
    
            if (propsDarkMode !== darkMode) {
              setDarkMode(propsDarkMode)
            }
          }
  
          // console.log("set alignment", alignment?.uuid.substring(0, 4), "->", propsAlignment.uuid.substring(0, 4))
        }
  
        if ((propsPinnedColumns !== undefined) && (pinnedColumns !== propsPinnedColumns)) {
          setPinnedColumns(propsPinnedColumns)
          onChangePinnedColumns?.(propsPinnedColumns)
        }
  
        if ((propsOtherVisibleColumns !== undefined) && (otherVisibleColumns !== propsOtherVisibleColumns)) {
          setOtherVisibleColumns(propsOtherVisibleColumns)
          onChangeOtherVisibleColumns?.(propsOtherVisibleColumns)
        }
  
        // if ((propsCollapsedGroups !== undefined) && (collapsedGroups !== propsCollapsedGroups)) {
        //   setCollapsedGroups(propsCollapsedGroups)
        // }
  
        if ((propsFileOrUrl !== undefined) && (propsFileOrUrl !== fileOrUrl)) {
          setFileOrUrl(propsFileOrUrl)
          setCollapsedGroups([])
  
          if (s2Ref.current?.options.style?.colCfg?.widthByFieldValue) {
            s2Ref.current.options.style.colCfg.widthByFieldValue = undefined
          }
        }
      }

      onBusy?.(false)
    }
    asyncUpdate()
  }, [
    alignmentViewerProps.fileOrUrl,
    alignmentViewerProps.referenceSequenceIndex,
    alignmentViewerProps.pinnedColumns,
    alignmentViewerProps.otherVisibleColumns,
    alignmentViewerProps.groupBy,
    alignmentViewerProps.sortBy,
    alignmentViewerProps.alignmentColorPalette,
    alignmentViewerProps.darkMode,
    alignmentViewerProps.positionsToStyle,
    fileOrUrl,
    alignment,
    pinnedColumns,
    otherVisibleColumns,
    collapsedGroups,
    sortBy,
    sortedIndices,
    positionsToStyle,
    alignmentColorPalette,
    darkMode,
    maxMinimapWidth,
    maxMinimapHeight,
    onLoadAlignment,
    onChangeAlignment,
    onChangeSortBy,
    onChangeOtherVisibleColumns, 
    onChangePinnedColumns,
    onBusy,
  ])

  const [sortedDisplayedIndices, isCollapsedGroup]: [number[], boolean[]] = useMemo(() => {
    if (alignment?.groupBy === undefined) {
      return [[], []]
    }

    if (alignment?.groupBy === false) {
      return [[...sortedIndices], Array(sortedIndices.length).fill(false)]
    }

    const sortedDisplayedIndices: number[] = []
    const isCollapsedGroup: boolean[] = []
    const shouldDisplay: boolean[] = new Array(alignment.groups.length).fill(true)
    for (const sequenceIndex of sortedIndices) {
      const groupIndex = alignment.annotations.__groupIndex__[sequenceIndex]
      if (shouldDisplay[groupIndex]) {
        sortedDisplayedIndices.push(sequenceIndex)
        if (collapsedGroups.includes(groupIndex)) {
          shouldDisplay[groupIndex] = false
          isCollapsedGroup.push(true)
        } else {
          isCollapsedGroup.push(false)
        }
      }
    }
    return [sortedDisplayedIndices, isCollapsedGroup]
  }, [
    sortedIndices, 
    collapsedGroups, 
    alignment?.groupBy,
    alignment?.annotations.__groupIndex__, 
    alignment?.groups.length
  ])

  const {
    s2DataCfg, 
    firstResidueColIndex, 
    firstSequenceRowIndex,
    groupSizeAtRowIndex,
    isCollapsedGroupAtRowIndex,
  } = useS2DataCfg(alignment, sortedDisplayedIndices, isCollapsedGroup, columns, isOverviewMode)
  // useChangeDetector()
  // useChangeDetector("s2DataCfg changed", s2DataCfg)
  // useChangeDetector("- alignment changed", alignment)
  // useChangeDetector("- sortedDisplayedIndices changed", sortedDisplayedIndices)
  // useChangeDetector("- columns changed", columns)
  // useChangeDetector("- isOverviewMode changed", isOverviewMode)

  const rowHeightsByField = useMemo(() => {
    // side effect, work around a bug in antv/s2 re merging options
    if (s2Ref.current?.options.style?.rowCfg) {
      s2Ref.current.options.style.rowCfg.heightByField = undefined
    }  

    let i = 0
    const heights: Record<string, number> = {}

    for (const key of Object.keys(SPECIAL_ROWS) as Array<keyof typeof SPECIAL_ROWS>) {
      heights[`${i}`] = toggles[key].visible ? Math.ceil(SPECIAL_ROWS[key].height * dimensions.rowHeight) + dimensions.paddingTop + dimensions.paddingBottom : 0
      ++i
    }

    if (alignment?.groupBy !== undefined) {
      for (const sequenceIndex of sortedDisplayedIndices) {
        const groupIndex = alignment.annotations.__groupIndex__[sequenceIndex]
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
    alignment?.groupBy, 
    alignment?.annotations.__groupIndex__,
    dimensions,
  ])


  const columnWidthsRef = useRef<TColumnWidths>({
    alignmentUuid: alignment?.uuid,
    fieldWidths: {},
    isGrouped: (alignment?.groupBy !== undefined),
    isResizing: undefined,
    zoom,
  })

  // console.log("setS2Options EFFECT", dimensions, highlightCurrentSequence)
  const showMinimap = toggles["$$MiniMap$$"].visible
  const s2Options = useS2Options(
    alignment,
    columns,
    columnWidthsRef,
    pinnedColumnsCount,
    sortBy,
    isCollapsedGroupAtRowIndex,
    isOverviewMode,
    window.devicePixelRatio,
    dimensions, 
    scrollbarSize,
    showMinimap, 
    rowHeightsByField, 
    highlightCurrentSequence, 
    handleColHeaderActionIconClick, 
  )
  // useChangeDetector()
  // useChangeDetector("s2Options changed", s2Options)
  // useChangeDetector("- alignment changed", alignment)
  // useChangeDetector("- columns changed", columns)
  // useChangeDetector("- columnWidthsRef changed", columnWidthsRef)
  // useChangeDetector("- pinnedColumnsCount changed", pinnedColumnsCount)
  // useChangeDetector("- sortBy changed", sortBy)
  // useChangeDetector("- collapsedGroups changed", collapsedGroups)
  // useChangeDetector("- isOverviewMode changed", isOverviewMode)
  // useChangeDetector("- dimensions changed", dimensions)
  // useChangeDetector("- scrollbarSize changed", scrollbarSize)
  // useChangeDetector("- showMinimap changed", showMinimap)
  // useChangeDetector("- rowHeightsByField changed", rowHeightsByField)
  // useChangeDetector("- highlightCurrentSequence changed", highlightCurrentSequence)
  // useChangeDetector("- handleColHeaderActionIconClick changed", handleColHeaderActionIconClick)
  
  const sequenceLogosCommonProps = useMemo(() => {
    const logoHeight = rowHeightsByField[`${Object.keys(SPECIAL_ROWS).indexOf("$$sequence logo$$")}`] - dimensions.paddingTop - dimensions.paddingBottom
    const barMode = (zoom < SEQUENCE_LOGO_BAR_STACK_ZOOM)
    let colorPalette
    if (barMode) {
      colorPalette = darkMode ? alignmentColorPalette["Dark"] : alignmentColorPalette["Light"]
    } else {
      colorPalette = darkMode ? alignmentColorPalette["Light"] : alignmentColorPalette["Dark"]
    }

    return {
      width: dimensions.residueWidth,
      height: logoHeight,
      fontSize: dimensions.fontSize,
      fontFamily: residueFontFamily,
      fontWidth: dimensions.residueFontWidth,
      fontActualBoundingBoxAscents: dimensions.residueFontActualBoundingBoxAscents,
      fontActualBoundingBoxDescents: dimensions.residueFontActualBoundingBoxDescents,
      barMode,
      colorPalette,
      defaultTextColor: colorTheme.text, 
      referenceSequence: alignment?.sequences[alignment?.referenceSequenceIndex] ?? "",
      consensusSequence: alignment?.positionalAnnotations.consensus ?? "",
      positionsToStyle: positionsToStyle,
      alphabetToPssmIndex: alignment?.alphabetToPssmIndex ?? {},
    }
  }, [
    zoom,
    alignment?.alphabetToPssmIndex,
    alignment?.sequences,
    alignment?.referenceSequenceIndex,
    alignment?.positionalAnnotations.consensus,
    dimensions, 
    colorTheme.text, 
    alignmentColorPalette, 
    darkMode,
    positionsToStyle, 
    residueFontFamily, 
    rowHeightsByField,
  ])
  
  const dpr = window.devicePixelRatio
  const capacity = 10000
  const offscreenCanvasPool = useMemo(() => {
    const { width, height } = sequenceLogosCommonProps
    const pool = new ObjectPool(
      () => (new OffscreenCanvas(width * dpr, height * dpr)),
      capacity,
    )
    return pool
  }, [sequenceLogosCommonProps, dpr, capacity])

  const sequenceLogos = useSequenceLogos({
    offscreenCanvasPool,
    pssmOrGroups: alignment?.positionalAnnotations.pssm,
    ...sequenceLogosCommonProps,
  })

  const sequenceLogosGroups = useSequenceLogos({
    offscreenCanvasPool,
    pssmOrGroups: alignment?.groups,
    ...sequenceLogosCommonProps,
  })


  const sprites = useMemo(() => {
    return new Sprites({
      alphabet: alignment?.alphabet ?? "",
      dpr,
      width: dimensions.residueWidth, 
      height: dimensions.rowHeight + dimensions.paddingTop + dimensions.paddingBottom, 
      font: `${dimensions.fontSize}px ${residueFontFamily}`,
      fontActualBoundingBoxAscents: dimensions.residueFontActualBoundingBoxAscents,
      fontActualBoundingBoxDescents: dimensions.residueFontActualBoundingBoxDescents,
      textColor: darkMode ? alignmentColorPalette["Light"] : alignmentColorPalette["Dark"],
      defaultTextColor: colorTheme.text,
      mutedTextColor: colorTheme.headerBorder,
      backgroundColor: ((alignmentColorMode === "Letter Only") && !isOverviewMode) 
        ? undefined 
        : darkMode 
        ? alignmentColorPalette["Dark"] 
        : alignmentColorPalette["Light"],
      isOverviewMode,
    })
  }, [
    alignment?.alphabet, 
    dpr, 
    dimensions, 
    residueFontFamily, 
    colorTheme.text, 
    colorTheme.headerBorder,
    alignmentColorPalette, 
    alignmentColorMode, 
    darkMode,
    isOverviewMode
  ])

  const barSprites = useMemo(() => {
    // const maxBarHeight = rowHeightsByField[`${Object.keys(SPECIAL_ROWS).indexOf("$$coverage$$")}`] - dimensions.paddingTop - dimensions.paddingBottom
    const maxBarHeight = SPECIAL_ROWS["$$coverage$$"].height * dimensions.rowHeight
    return new BarSprites({
      width: dimensions.residueFontWidth,
      height: maxBarHeight,
      barColor: "#9da7b6", // this.spreadsheet.theme.dataCell.text.fill
    })
  }, [
    // rowHeightsByField, 
    dimensions.rowHeight,
    // dimensions.paddingTop, 
    // dimensions.paddingBottom, 
    dimensions.residueFontWidth, 
  ])

  const avExtraOptions: TAVExtraOptions = useMemo(() => ({
    zoom, 
    isOverviewMode, 
    residueFontFamily, 
    dimensions, 
    alignmentColorMode, 
    alignmentColorPalette, 
    positionsToStyle, 
    hideUnstyledPositions,
    sprites, 
    alignment, 
    collapsedGroups,
    sortedDisplayedIndices, 
    firstSequenceRowIndex, 
    firstResidueColIndex, 
    groupSizeAtRowIndex,
    isCollapsedGroupAtRowIndex,
    overviewImageData, 
    showMinimap, 
    minimapImage, 
    sequenceLogos, 
    sequenceLogosGroups, 
    barSprites, 
    scrollbarSize,
  }), [
    zoom, 
    isOverviewMode, 
    residueFontFamily, 
    dimensions, 
    alignmentColorMode, 
    alignmentColorPalette, 
    positionsToStyle, 
    hideUnstyledPositions,
    sprites, 
    alignment, 
    collapsedGroups,
    sortedDisplayedIndices, 
    firstSequenceRowIndex, 
    firstResidueColIndex, 
    groupSizeAtRowIndex,
    isCollapsedGroupAtRowIndex,
    overviewImageData, 
    showMinimap, 
    minimapImage, 
    sequenceLogos, 
    sequenceLogosGroups, 
    barSprites, 
    scrollbarSize, 
  ])

  // useChangeDetector()
  // useChangeDetector("avExtraOptions changed", avExtraOptions)
  // useChangeDetector("- zoom changed", zoom)
  // useChangeDetector("- isOverviewMode changed", isOverviewMode)
  // useChangeDetector("- residueFontFamily changed", residueFontFamily)
  // useChangeDetector("- dimensions changed", dimensions)
  // useChangeDetector("- alignmentColorMode changed", alignmentColorMode)
  // useChangeDetector("- alignmentColorPalette changed", alignmentColorPalette)
  // useChangeDetector("- positionsToStyle changed", positionsToStyle)
  // useChangeDetector("- hideUnstyledPositions changed", hideUnstyledPositions)
  // useChangeDetector("- sprites changed", sprites)
  // useChangeDetector("- alignment changed", alignment)
  // useChangeDetector("- collapsedGroups changed", collapsedGroups)
  // useChangeDetector("- sortedDisplayedIndices changed", sortedDisplayedIndices)
  // useChangeDetector("- firstSequenceRowIndex changed", firstSequenceRowIndex)
  // useChangeDetector("- firstResidueColIndex changed", firstResidueColIndex)
  // useChangeDetector("- overviewImageData changed", overviewImageData)
  // useChangeDetector("- showMinimap changed", showMinimap)
  // useChangeDetector("- minimapImage changed", minimapImage)
  // useChangeDetector("- sequenceLogos changed", sequenceLogos)
  // useChangeDetector("- sequenceLogosGroups changed", sequenceLogosGroups)
  // useChangeDetector("- barSprites changed", barSprites)
  // useChangeDetector("- scrollbarSize changed", scrollbarSize)

  const handleCellIconClick = useCallback(({ event, target, viewMeta, iconName }: TAVMouseEventInfo) => {
    // if (!alignment?.annotations) {
    //   return
    // }

    if ((target.cellType === CellTypes.COL_CELL) && (viewMeta.field === SERIES_NUMBER_FIELD)) {
      handleExpandCollapseAllGroupsIconClick()
    } else if ((target.cellType === CellTypes.ROW_CELL) && (viewMeta.valueField === SERIES_NUMBER_FIELD)) {
      const i = viewMeta.rowIndex - firstSequenceRowIndex
      if (i < 0) {
        return
      }
      const groupIndex = alignment?.annotations.__groupIndex__[sortedDisplayedIndices[i]]
      if (groupIndex !== undefined) {
        handleExpandCollapseGroupIconClick(groupIndex)
      }
    }
  }, [
    firstSequenceRowIndex,
    sortedDisplayedIndices,
    alignment?.annotations.__groupIndex__,
    handleExpandCollapseAllGroupsIconClick,
    handleExpandCollapseGroupIconClick
  ])

  const handleMounted = useCallback((s2: SpreadSheet) => {
    // console.log("mounted", (s2 as AVTableSheet).id)
    // initAVStore(s2 as AVTableSheet)
    // (s2 as AVTableSheet).updateAVStore(avExtraOptions)
    window.s2 = s2 as unknown as AVTableSheet
  }, [/*avExtraOptions, initAVStore*/])

  const handleLayoutResizeColWidth = useCallback((params: ResizeParams) => {
    columnWidthsRef.current.isResizing = params.info.meta.field
  }, [])

  const handleLayoutAfterHeaderLayout = useCallback((layoutResult: LayoutResult) => {
    // console.log("handleLayoutAfterHeaderLayout", alignment?.uuid, !alignment?.uuid, alignment?.groupBy, !alignment?.groupBy)
    if (!alignment?.uuid) {
      return
    }

    columnWidthsRef.current.isResizing = undefined
    columnWidthsRef.current.isGrouped = (alignment?.groupBy !== undefined)
    columnWidthsRef.current.zoom = zoom
    if (columnWidthsRef.current.alignmentUuid !== alignment.uuid) {
      columnWidthsRef.current.alignmentUuid = alignment.uuid
      columnWidthsRef.current.fieldWidths = {}
    }

    for (const node of layoutResult.colLeafNodes) {
      columnWidthsRef.current.fieldWidths[node.field] = node.width
    }
  }, [alignment?.uuid, alignment?.groupBy, zoom])

  const handleDataCellHover = useCallback((data: TargetCellInfo): void => {
    onMouseHover?.(getAVMouseEventInfo(data))
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

    const info = getAVMouseEventInfo(data)
    info.target.onClick?.(info)
    // console.log("data clicked")
  }, [])

  const handleRowCellClick = handleDataCellClick

  const targetRowCellWhenMouseDownRef = useRef<S2CellType | null>(null)
  
  const handleRowCellMouseDown = useCallback((data: TargetCellInfo): void => {
    const { target, iconName } = getAVMouseEventInfo(data)
    if (iconName) {
      targetRowCellWhenMouseDownRef.current = target
    }
  }, [targetRowCellWhenMouseDownRef])

  const handleRowCellMouseUp = useCallback((data: TargetCellInfo): void => {
    const info = getAVMouseEventInfo(data)
    if (info.iconName && (info.target === targetRowCellWhenMouseDownRef.current)) {
      // handleRowCellClick(data)
      targetRowCellWhenMouseDownRef.current = null
      handleCellIconClick(info)
    }
  }, [handleCellIconClick])

  const handleContextMenu = useCallback((event: CanvasEvent) => {
    const target = s2Ref.current?.getCell(event.target) as S2CellType
    const viewMeta = target?.getMeta() as S2Node
    const info = getAVMouseEventInfo({ event, target, viewMeta })
    onContextMenu?.(info)
  }, [
    s2Ref, 
    onContextMenu
  ])

  // const handleSelected = useCallback((cells: S2CellType[]) => {
  //   // console.log("viewer", cells.length, cells[0].cellType)
  //   // s2Ref.current?.interaction.reset()
  //   // s2Ref.current?.interaction.removeIntercepts([InterceptType.HOVER])
  // }, [])

  // const handleBeforeRender = useCallback(() => {
  //   // console.log("***before render***")
  //   onBusy?.(true)
  // }, [onBusy])

  // const handleAfterRender = useCallback(() => {
  //   // console.log("***after render***")
  //   onBusy?.(false)
  // }, [onBusy])

  // const handleDestroy = useCallback(() => {
  //   console.log("destroy")
  // }, [])

  const spreadsheet = useCallback((container: S2MountContainer, dataCfg: S2DataConfig, options: SheetComponentOptions) => {
    // console.log("new AVTableSheet instance")
    return new AVTableSheet(container, dataCfg, options as S2Options, avExtraOptions)
  }, [avExtraOptions])
  
  const memoizedSheetComponent = useMemo(() => {
    // initAVStore(s2Ref.current)
    console.log("updateavstore in memoizedSheetComponent", avExtraOptions.alignment?.name)
    s2Ref.current?.updateAVStore(avExtraOptions)
    const adaptiveProp = (adaptiveContainerRef?.current) ? {
      width: true, 
      height: true, 
      getContainer: () => (adaptiveContainerRef.current as HTMLElement)
    } : undefined
    return (
      <SheetComponent
        ref={s2Ref}
        sheetType="table" // "table" or "editable"
        spreadsheet={spreadsheet}
        dataCfg={s2DataCfg}
        options={s2Options}
        themeCfg={s2ThemeCfg}
        adaptive={adaptiveProp}
        loading={false}
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
        // onColCellHover={handleNoContextualInfo}
        onColCellHover={handleDataCellHover}
        onContextMenu={handleContextMenu}
        onDataCellHover={handleDataCellHover}
        onCornerCellHover={handleNoContextualInfo}
        // onSelected={handleSelected}
        // onBeforeRender={handleBeforeRender}
        // onAfterRender={handleAfterRender}
        onMounted={handleMounted}
        // onDestroy={handleDestroy}
        onLayoutAfterHeaderLayout={handleLayoutAfterHeaderLayout}
        onLayoutResizeColWidth={handleLayoutResizeColWidth}
        onCopied={(data) => {console.log(data)}}
        onDataCellEditEnd={(meta) => {console.log('onDataCellEditEnd', meta)}}
        onSheetUpdate={(options)=>{console.log("onSheetUpdate", options); return options}}
      />
    )
  }, [
    // initAVStore,
    avExtraOptions,
    adaptiveContainerRef,
    spreadsheet,
    s2Ref,
    s2DataCfg,
    s2Options,
    s2ThemeCfg,
    handleDataCellClick,
    handleRowCellClick,
    handleRowCellMouseDown,
    handleRowCellMouseUp,
    handleContextMenu,
    handleDataCellHover,
    handleNoContextualInfo,
    // handleSelected,
    // handleBeforeRender,
    // handleAfterRender,
    handleMounted,
    // handleDestroy,
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
      console.log("force render avtable")
      s2Ref.current?.render(false, { reBuildDataSet: false, reBuildHiddenColumnsDetail: false, reloadData: false})
    }
  })

  return (
    <div 
      className={clsx("av-wrapper", className)} 
      style={style}
      onMouseLeave={handleNoContextualInfo} 
    >
      {alignment && memoizedSheetComponent}
    </div>
  )
})

