import type { ReactNode, CSSProperties, MutableRefObject } from 'react'
import type { TabsProps, } from 'antd'
import type {
  ViewMeta, 
  Node as S2Node,
  S2CellType, 
} from '@antv/s2'
import type { Event as CanvasEvent } from '@antv/g-canvas'
import type { RadioChangeEvent } from 'antd'
import type Sprites from './sprites'
import type BarSprites from './BarSprites'


import { ObjectPool } from "./objectPool"
import {
  PssmValuesArray,
  PssmIndicesArray,
  PssmTalliesArray,
  DEFAULT_GROUP_ANNOTATION_VALUES,
  ALIGNMENT_COLOR_MODES,
} from './constants'

export type TConstructor<T> = new (...args: any[]) => T

export type TColorEntry = {
  color: string, 
  rgba: number[],
}

export type TAlignmentColorPalette = Record<"Dark" | "Light", Map<string, TColorEntry>>

export type TAlignmentColorMode = (typeof ALIGNMENT_COLOR_MODES)[number]

export type TSequenceAnnotationFields = {
  [field: string]: {
    name: string,
    string: number,
    number: number,
  }
}

export type TAlignmentPositionsToStyle = "all" | "differentFromReference" | "sameAsReference" | "differentFromConsensus" | "sameAsConsensus"

type TBaseSequenceAnnotations = /*(typeof DEFAULT_GROUP_ANNOTATION_VALUES) &*/ {
  __id__: string,
  __actualId__: string,
  __sequenceIndex__: number,
  __begin__: number,
  __end__: number,
  __realLength__: number,
  __alignedLength__: number,
  __leftGapCount__: number,
  __internalGapCount__: number,
  __rightGapCount__: number,
  __links__: {name: string, url: string}[],
}

export type TSequenceAnnotations = TBaseSequenceAnnotations & Record<string, string | number | object>

export type TSequenceRecord = {
  sequence: string,
  annotations: TSequenceAnnotations,
  __annotationFields__: TSequenceAnnotationFields,
}

export type TPssmValues = InstanceType<typeof PssmValuesArray>
export type TPssmIndices = InstanceType<typeof PssmIndicesArray>
export type TPssmTallies = InstanceType<typeof PssmTalliesArray>
export type TPssm = {
  alphabet: string,
  values: TPssmValues,
  sortedIndices: TPssmIndices,
  length: number,
  gapIndex: number,
}

export type TSequenceGroup = {
  members: number[],
  pssm: TPssm,
}

export type TAlignmentAnnotations = {
  [K in keyof TSequenceAnnotations]: TSequenceAnnotations[K][]
} & {
  [K in keyof typeof DEFAULT_GROUP_ANNOTATION_VALUES]: typeof DEFAULT_GROUP_ANNOTATION_VALUES[K][]
} & {
  __hammingDistanceToReference__: number[],
  __hammingDistanceToConsensus__: number[],
  __blosum62ScoreToReference__: number[],
  __blosum62ScoreToConsensus__: number[],
}

type TBaseAlignmentPositionalAnnotations = {
  consensus: string,
  coverage: number[],
  pssm: TPssm,
  conservation: number[],
  entropy: {
    values: number[],
    max: number,
  },
  klDivergence: {
    values: number[],
    max: number,
  }
}

export type TAlignmentPositionalAnnotations = TBaseAlignmentPositionalAnnotations & {
  [key: string]: string | number[] | {
    values: number[],
    max: number,
  }
}

export type TAlignment = {
  name: string,
  uuid: string,
  length: number,
  depth: number,
  alphabet: string,
  pssmAlphabet: string, 
  pssmGapIndex: number, 
  alphabetToPssmIndex: Record<string, number>,
  sequences: string[], 
  referenceSequenceIndex: number,
  annotations: TAlignmentAnnotations,
  annotationFields: TSequenceAnnotationFields,
  positionalAnnotations: TAlignmentPositionalAnnotations,
  groupBy: string | number | false,
  groups: TSequenceGroup[],
}

export type THammingDistanceCompareFunction = (a: string, b: string) => number

export type TAlignmentSortParams = {
  field: string,
  order: "asc" | "desc"
}

// eslint-disable-next-line  @typescript-eslint/no-explicit-any
export type TAVExtraOptions = {
  zoom: number, 
  isOverviewMode: boolean, 
  residueFontFamily: string, 
  dimensions: TDimensions, 
  alignmentColorMode: TAlignmentColorMode, 
  alignmentColorPalette: TAlignmentColorPalette, 
  positionsToStyle: TAlignmentPositionsToStyle, 
  hideUnstyledPositions: boolean,
  sprites: Sprites, 
  alignment: TAlignment | undefined, 
  collapsedGroups: number[],
  sortedDisplayedIndices: number[], 
  firstSequenceRowIndex: number, 
  firstResidueColIndex: number, 
  groupSizeAtRowIndex: number[],
  isCollapsedGroupAtRowIndex: boolean[],
  overviewImageData: ImageData | undefined, 
  showMinimap: boolean, 
  minimapImage: OffscreenCanvas | undefined, 
  sequenceLogos: TSequenceLogos, 
  sequenceLogosGroups: TSequenceLogos, 
  barSprites: BarSprites, 
  scrollbarSize: number,
}

export type TColumnWidths = {
  alignmentUuid: string | undefined,
  fieldWidths: Record<string, number>,
  isGrouped: boolean,
  zoom: number,
  isResizing: string | undefined,
}

export type TBarSpritesProps = {
  width: number,
  height: number,
  barColor: string,
}

export type TSpriteProps = {
  alphabet: string,
  dpr: number,
  width: number,
  height: number,
  font: string,
  fontActualBoundingBoxAscents: Record<string, number>,
  fontActualBoundingBoxDescents: Record<string, number>,
  textColor: string | Map<string, TColorEntry>,
  defaultTextColor: string,
  mutedTextColor: string,
  backgroundColor?: string | Map<string, TColorEntry>,
  rotation?: number,
  isOverviewMode: boolean,
}

type TSequenceLogosParams = {
  width: number,
  height: number,
  fontSize: number,
  fontFamily: string,
  fontWidth: number,
  fontActualBoundingBoxAscents: Record<string, number>,
  fontActualBoundingBoxDescents: Record<string, number>,
  barMode: boolean,
  colorPalette: Map<string, TColorEntry>,
  defaultTextColor: string, 
  referenceSequence: string,
  consensusSequence: string,
  positionsToStyle: TAlignmentPositionsToStyle,
  alphabetToPssmIndex: Record<string, number>,
}

export type TUseSequenceLogosProps = TSequenceLogosParams & {
  pssmOrGroups?: TPssm | TSequenceGroup[],
  offscreenCanvasPool: ObjectPool<OffscreenCanvas>,
}

export type TSequenceLogos = undefined | {
  props: TUseSequenceLogosProps,
  get: (sequencePosition: number, groupIndex?: number) => OffscreenCanvas | undefined,
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

export type TNormalizedPosition = {
  rowIndex: number,
  colIndex: number,
  sequencePosition: number,
  sequenceRowIndex: number, // useful in overview mode
}

export type TAVMouseEventInfo = {
  event: CanvasEvent, 
  target: S2CellType<ViewMeta>, 
  viewMeta: ViewMeta | S2Node, 
  iconName: string | undefined,
  normalizedPosition: TNormalizedPosition,
  contextualInfo?: TContextualInfo,
}

export type TSelectedCellsRange = {
  [K in keyof TNormalizedPosition]: TNormalizedPosition[K][]
}

export type TSetContextualInfo = (info?: TAVMouseEventInfo) => void

export type TDimensions = {
  zoom: number,
  fontFamily: string,
  residueFontFamily: string,
  fontSize: number,
  regularTextHeight: number,
  residueFontWidth: number, 
  residueFontHeight: number, 
  residueFontActualBoundingBoxAscents: Record<string, number>, 
  residueFontActualBoundingBoxDescents: Record<string, number>,
  residueWidth: number, 
  residueHeight: number,
  residueLetterSpacing: string,
  paddingLeft: number,
  paddingRight: number,
  paddingTop: number,
  paddingBottom: number,
  rowHeight: number,
  colHeight: number,
  cornerCellWidth: number,
  residueNumberFontSize: number,
  residueNumberHeight: number,
  residueNumberTextActualBoundingBoxDescent: number,
  minMinimapWidth: number,
  maxMinimapWidth: number,
  minimapMargin: number, 
  iconSize: number,
  iconMarginLeft: number,
  iconMarginRight: number,
}

export type TAlignmentViewerProps = {
  className?: string,
  style?: CSSProperties,
  fileOrUrl: File | string,
  referenceSequenceIndex: number | undefined,
  pinnedColumns: string[] | undefined,
  otherVisibleColumns: string[] | undefined,
  sortBy: TAlignmentSortParams[] | undefined,
  groupBy: string | number | false | undefined,
  zoom?: number,
  isOverviewMode?: boolean,
  toggles?: TAlignmentViewerToggles,
  fontFamily?: string,
  residueFontFamily?: string,
  alignmentColorPalette?: TAlignmentColorPalette,
  alignmentColorMode?: TAlignmentColorMode,
  positionsToStyle?: TAlignmentPositionsToStyle, 
  hideUnstyledPositions?: boolean,
  scrollbarSize?: number,
  highlightCurrentSequence?: boolean,
  colorTheme: TAVColorTheme,
  darkMode?: boolean,
  adaptiveContainerRef?: MutableRefObject<HTMLElement | null>,
  onLoadAlignment?: (alignment: TAlignment | undefined, isLoading: boolean, error: unknown) => void,
  onChangeAlignment?: (alignment: TAlignment) => void,
  onChangeSortBy?: (sortBy: TAlignmentSortParams[]) => void,
  onChangePinnedColumns?: (pinnedColumns: string[]) => void,
  onChangeOtherVisibleColumns?: (otherVisibleColumns: string[]) => void,
  onMouseHover?: TSetContextualInfo,
  onContextMenu?: (info: TAVMouseEventInfo) => void,
  onBusy?: (isBusy: boolean) => void,
}

export type TFileOrUrlPickerProps = {
  fileOrUrl?: File | string | null,
  extraTabs?: TabsProps["items"],
  activeTabKey?: "file" | "url" | string,
  isLoading: boolean,
  error: unknown,
  className?: string,
  style?: CSSProperties,
  onChange: (fileOrUrl: File | string) => void,
  onTabKeyChange: (activeKey: string) => void,
}

export type TAlignmentPickerProps = Omit<TFileOrUrlPickerProps, "extraTabs" | "activeTabKey" | "onTabKeyChange">

export type TSettingsProps = {
  fileOrUrl?: File | string | null,
  isLoading: boolean,
  error: unknown,
  zoom: number,
  toggles: TAlignmentViewerToggles,
  colorScheme?: string,
  colorMode?: TAlignmentColorMode,
  positionsToStyle?: TAlignmentPositionsToStyle, 
  hideUnstyledPositions?: boolean,
  contextualInfoContainer?: string,
  darkMode: boolean,
  onFileOrUrlChange: (newFileOrUrl: File | string) => void,
  onZoomChange: (newZoom: number) => void,
  onTogglesChange: (item: string, active: boolean) => void,
  onColorSchemeChange: (value: string) => void,
  onColorModeChange: (value: TAlignmentColorMode) => void,
  onPositionsToStyleChange: (value: TAlignmentPositionsToStyle) => void,
  onHideUnstyledPositionsChange: (checked: boolean) => void,
  onContextualInfoContainerChange: (event: RadioChangeEvent) => void,
  onDarkModeChange: () => void,
}

