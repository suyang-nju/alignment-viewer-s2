import type {
  TAlignment, 
  TAlignmentPositionsToStyle, 
  TAlignmentSortParams, 
  TAlignmentAnnotations,
  TSequenceAnnotationFields,
  TAlignmentColorMode,
  TAlignmentViewerToggles, 
  TContextualInfo, 
  TSetMouseEventInfo, 
  TAVMouseEventInfo,
} from '../lib/types'
import type { MouseEvent, ReactNode } from 'react'
import type { RadioChangeEvent, MenuProps } from 'antd'

import {
  ALIGNMENT_COLOR_MODES,
  OVERVIEW_MODE_ZOOM,
} from '../lib/constants'
import { defaultTheme, darkTheme } from '../theme/themeConfig'
import { alignmentColorSchema } from '../lib/AlignmentColorSchema'
import { defaultAlignmentViewerToggles, } from './AlignmentViewer'
import AlignmentViewerAntdWrapper from './AlignmentViewerAntdWrapper'
import CursorTracker from './CursorTracker'
import Settings from './Settings'
import Welcome from './Welcome'
import ActionMenuButton from './ActionMenuButton'
import ArrangeColumns from './ArrangeColumns'
import SortByColumns from './SortByColumns'
import ImportAnnotations from './ImportAnnotations'
import { createContextMenu, createSortMenu, createGroupByMenu, createShowHideColumnsMenu } from '../lib/menu'
import { getAlignmentAnnotationFields } from '../lib/alignment'

import { debounce } from 'lodash'
import { useSearchParams, Link } from 'react-router-dom'
import { useState, useEffect, useImperativeHandle, useRef, forwardRef, useMemo, useCallback } from 'react'
import { 
  ConfigProvider, theme as antdTheme, Flex, Space, Button, 
  Tooltip, Tag, Typography, Layout, Spin, Dropdown, Empty,
} from 'antd'
import { MenuOutlined, LoadingOutlined } from '@ant-design/icons'
import clsx from 'clsx'

// eslint-disable-next-line  @typescript-eslint/no-explicit-any
function BusyIndicator(props: Record<string, any>) {
  return <div className='busy-indicator busy-animation' {...props} />
}


const StatusBar = forwardRef(function StatusBar(props, ref) {
  const [mouseEventInfo, setMouseEventInfo] = useState<TAVMouseEventInfo | undefined>(undefined)

  useImperativeHandle(ref, () => (info?: TAVMouseEventInfo) => {
    setMouseEventInfo(info)
  }, [])

  const body: ReactNode[] = []
  if (mouseEventInfo) {
    if ((mouseEventInfo.sequenceRowIndex >= 0) || (mouseEventInfo.sequencePosition >= 0)) { 
      body.push(
        <Flex key="row-col" className="row-col">
          {(mouseEventInfo.sequenceRowIndex >= 0) && <div key="row" className="row">Row {mouseEventInfo.sequenceRowIndex + 1}</div>}
          {(mouseEventInfo.sequencePosition >= 0) && <div key="col" className="col">Col {mouseEventInfo.sequencePosition + 1}</div>}
        </Flex>
      )
    }
    
    if (mouseEventInfo.sequenceId) {
      body.push(
        <div key="sequenceId" className="sequence-id">{mouseEventInfo.sequenceId}</div>
      )
    }
    
    for (const node of mouseEventInfo.extraInfo) {
      body.push(node)
    }
  }

  // const antdThemeToken = antdTheme.useToken().token
  const { className, ...otherProps } = props
  return (
    <Flex 
      className={clsx("status-bar", className)} 
      gap="small"
      {...otherProps} 
    >
      {body.length ? body : "\xa0"}
    </Flex>
  )
})

const ContextualInfoTooltip = forwardRef(function ContextualInfoTooltip(props, ref) {
  const [mouseEventInfo, setMouseEventInfo] = useState<TAVMouseEventInfo | undefined>(undefined)
  const timeoutRef = useRef(0)

  useImperativeHandle(ref, () => debounce((info?: TAVMouseEventInfo) => {
    setMouseEventInfo(info)
  }, 100, {leading: false, trailing: true}), [])

  if (timeoutRef.current) {
    window.clearTimeout(timeoutRef.current)
  }
  
  timeoutRef.current = window.setTimeout(() => { setMouseEventInfo(undefined) }, 10000)

  if (!mouseEventInfo) {
    return null
  } else {
    const body = (
      <>
        <div className="contextual-info-tooltip-header">
          {((mouseEventInfo.sequenceRowIndex >= 0) || (mouseEventInfo.sequencePosition >= 0)) && (
            <div key="row-col" className="row-col">
              {(mouseEventInfo.sequenceRowIndex >= 0) && <div key="row" className="row">Row {mouseEventInfo.sequenceRowIndex + 1}</div>}
              {(mouseEventInfo.sequencePosition >= 0) && <div key="col" className="col">Col {mouseEventInfo.sequencePosition + 1}</div>}
            </div>
          )}
          {mouseEventInfo.sequenceId && <div key="sequenceId" className="sequence-id">{mouseEventInfo.sequenceId}</div>}
        </div>
        <div className="contextual-info-tooltip-body">
          {mouseEventInfo.extraInfo}
        </div>
      </>
    )

    const { className, ...otherProps } = props
    const left = mouseEventInfo.visible.left + mouseEventInfo.event.clientX - mouseEventInfo.event.x
    const top = mouseEventInfo.visible.top + mouseEventInfo.event.clientY - mouseEventInfo.event.y
    const width = mouseEventInfo.visible.width
    const height = mouseEventInfo.visible.height
    // const matrix = `matrix(${width}, 0, 0, ${height}, ${left}, ${top})`
    return (
      <Tooltip 
        title={body}
        className={className} 
        // placement="bottomLeft"
        open={true}
        arrow={false}
        overlayClassName="contextual-info-tooltip"
        {...otherProps} 
      >
        <div
          key={mouseEventInfo.key}
          style={{
            pointerEvents: "none",
            position: "absolute",
            left,
            top,
            width,
            height,
            visibility: "hidden",
          }}
          // style={{
          //   pointerEvents: "none",
          //   position: "absolute",
          //   left: 0,
          //   top: 0,
          //   width: 1,
          //   height: 1,
          //   transformOrigin: "top left",
          //   transform: matrix,
          //   visibility: "hidden",
          // }}
        />
      </Tooltip>
    )
  }
})

export default function Chrome() {
  // console.log("render chrome")

  const [spinning, setSpinning] = useState(false)
  const startSpinningTimerRef = useRef<number>(0)
  const stopSpinningTimerRef = useRef<number>(0)
  const changeSpinning = useCallback((how: "start" | "stop", ms: number) => {
    // console.log("set spin", how === "start")
    // if (how === "start") {
    //   setSpinning(true)
    //   return
    // }
    // setSpinning(how === "start")

    let thisTimerRef, otherTimerRef
    if (how === "start") {
      thisTimerRef = startSpinningTimerRef
      otherTimerRef = stopSpinningTimerRef
    } else {
      thisTimerRef = stopSpinningTimerRef
      otherTimerRef = startSpinningTimerRef
    }

    if (otherTimerRef.current > 0) {
      window.clearTimeout(otherTimerRef.current)
      otherTimerRef.current = 0
    }

    if (thisTimerRef.current === 0) {
      thisTimerRef.current = window.setTimeout(() => {
        setSpinning(how === "start")
      }, ms)
    }
  }, [])

  const startSpinning = useCallback(() => {
    // console.log("star spinning")
    changeSpinning("start", 100)
  }, [changeSpinning])

  const stopSpinning = useCallback(() => {
    // console.log("stop spinning")
    changeSpinning("stop", 200)
  }, [changeSpinning])

  function useStartSpinning(func: (...args: any[]) => void) {
    return useCallback((...args: any[]) => {
      startSpinning()
      func(...args)
    }, [func])
  }

  const { Text } = Typography
  const antdThemeToken = antdTheme.useToken().token

  const alignmentViewerRef = useRef<{ 
    updateAnnotations:(updatedAnnotations: TAlignmentAnnotations, updatedAnnotationFields: TSequenceAnnotationFields) => void 
  }>(null)
  const settingsRef = useRef<{ open: () => void, close: () => void }>(null)
  const setContextualInfoRef = useRef<undefined | TSetMouseEventInfo>(undefined)
  const cursorTrackerRef = useRef<undefined | ((info?: TAVMouseEventInfo) => void)>(undefined)
  const arrangeColumnsRef = useRef<{open: () => void}>(null)
  const sortByColumnsRef = useRef<{open: () => void}>(null)
  const importAnnotationsRef = useRef<{open: () => void}>(null)

  const [zoom, setZoom] = useState<number>(12)
  const isOverviewMode: boolean = (zoom <= OVERVIEW_MODE_ZOOM)
  const [toggles, setToggles] = useState<TAlignmentViewerToggles>(defaultAlignmentViewerToggles)

  const [colorScheme, setColorScheme] = useState(Object.keys(alignmentColorSchema)[0])
  const [colorMode, setColorMode] = useState<TAlignmentColorMode>(ALIGNMENT_COLOR_MODES[0])
  const [positionsToStyle, setPositionsToStyle] = useState<TAlignmentPositionsToStyle>("all")
  const [hideUnstyledPositions, setHideUnstyledPositions] = useState(false)
  const [contextualInfoContainer, setContextualInfoContainer] = useState("status bar")
  const systemDarkMode = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
  const [darkMode, setDarkMode] = useState(systemDarkMode)
  if (document.documentElement.style.colorScheme !== (darkMode ? "dark" : "light")) {
    document.documentElement.style.colorScheme = darkMode ? "dark" : "light"
  }

  useEffect(() => {
    function handleSystemDarkModeChange(event: MediaQueryListEvent) {
      setDarkMode(event.matches)
    }

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener("change", handleSystemDarkModeChange)

    return () => {
      window.matchMedia('(prefers-color-scheme: dark)').removeEventListener("change", handleSystemDarkModeChange)
    }
  }, [setDarkMode])

  const showSettings = (event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation()
    settingsRef.current?.open()
  }

  const handleCloseSettingsFromOther = () => {
    settingsRef.current?.close()
  }

  const showArrangeColumns = () => {
    arrangeColumnsRef.current?.open()
  }

  const showImportAnnotations = () => {
    importAnnotationsRef.current?.open()
  }

  const showSortByColumns = () => {
    sortByColumnsRef.current?.open()
  }

  const handleToggleChange = (item: string, isActive: boolean) => {
    setToggles({...toggles, [item]: {label: toggles[item].label, visible: isActive}})
  }

  const handleZoomChange = useCallback(debounce((value: number) => {
    setZoom(value)
  }, 200, {leading: false, trailing: true}), [setZoom])

  const handleColorSchemeChange = (value: string) => {
    setColorScheme(value)
  }

  const handleColorModeChange = (value: TAlignmentColorMode) => {
    setColorMode(value)
  }

  const handlePositionsToStyleChange = (value: TAlignmentPositionsToStyle) => {
    setPositionsToStyle(value as TAlignmentPositionsToStyle)
  }

  const handleContextualInfoContainerChange = (event: RadioChangeEvent) => {
    setContextualInfoContainer(event.target.value)
  }

  const handleDarkModeChange = () => {
    setDarkMode(!darkMode)
  }

  const [file, setFile] = useState<File | undefined>()
  const [searchParams, setSearchParams] = useSearchParams()
  const url = searchParams.get("url")
  const fileOrUrl = file || url
  const [prevFileOrUrl, setPrevFileOrUrl] = useState<File | string | null | undefined>(undefined)

  // Set the following to `undefined` to indicate we want to use default values (derived from alignment)
  const [referenceSequenceIndex, setReferenceSequenceIndex] = useState<number | undefined>(undefined)
  const [pinnedColumns, setPinnedColumns] = useState<string[] | undefined>(undefined)
  const [otherVisibleColumns, setOtherVisibleColumns] = useState<string[] | undefined>(undefined)
  const [sortBy, setSortBy] = useState<TAlignmentSortParams[] | undefined>(undefined)
  const [groupBy, setGroupBy] = useState<string | number | false | undefined>(undefined)

  if (fileOrUrl !== prevFileOrUrl) {
    setPrevFileOrUrl(fileOrUrl)
    // Set the following to `undefined` to indicate we want to use default values (derived from alignment)
    setReferenceSequenceIndex(undefined)
    setPinnedColumns(undefined)
    setOtherVisibleColumns(undefined)
    setSortBy(undefined)
    setGroupBy(undefined)
  }

  const [isLoadingAlignment, setIsLoadingAlignment] = useState(false)
  const [error, setError] = useState<unknown>(undefined)
  const [alignment, setAlignment] = useState<TAlignment | undefined>(undefined)
  const groupCount = alignment?.groups.length

  const [annotationFields, availableColumnsImported, availableColumnsDerived] = useMemo(() => {
    let annotationFields: TSequenceAnnotationFields = {}
    let availableColumnsImported: string[] = []
    let availableColumnsDerived: string[] = []
    if (alignment) {
      annotationFields = alignment.annotationFields
      ;({
        importedFields: availableColumnsImported, 
        derivedFields: availableColumnsDerived,
      } = getAlignmentAnnotationFields(alignment))
    }
    return [annotationFields, availableColumnsImported, availableColumnsDerived]
  }, [alignment])


  const handleFileOrUrlChange = /*useStartSpinning*/((newFileOrUrl: File | string) => {
    if (newFileOrUrl === file) {
      return
    }
    
    const currentUrl = searchParams.get("url")
    if (newFileOrUrl === currentUrl) {
      return
    }

    if (newFileOrUrl instanceof File) {
      setFile(newFileOrUrl)
      if (currentUrl) {
        setSearchParams([])
      }
    } else {
      setSearchParams([["url", newFileOrUrl]], { relative: "path" })
      if (file) {
        setFile(undefined)
      }  
    }
  })

  const handleChangeAlignment = useCallback((newAlignment: TAlignment) => {
    setAlignment(newAlignment)
    setReferenceSequenceIndex(newAlignment.referenceSequenceIndex)
    setGroupBy(newAlignment.groupBy)
  }, [])

  const handleChangeOtherVisibleColumns = useCallback((otherVisibleColumns: string[]) => {
    setOtherVisibleColumns(otherVisibleColumns)
  }, [])

  const handleChangePinnedColumns = useCallback((pinnedColumns: string[]) => {
    setPinnedColumns(pinnedColumns)
  }, [])

  const handleChangeSortBy = useCallback((sortBy: TAlignmentSortParams[]) => {
    setSortBy(sortBy)
  }, [])

  const handleLoadAlignment = useCallback((alignment: TAlignment | undefined, isLoading: boolean, error: unknown) => {
    if (alignment !== undefined) {
      setAlignment(alignment)
    }

    setIsLoadingAlignment(isLoading)
    if (!isLoading) {
      settingsRef.current?.close()
    }

    setError(error)
  }, [])

  let displayFileName: string | ReactNode = ""
  if (alignment) {
    displayFileName = (
      <>
        <Text strong>{url ? <Link to={url}>{url}</Link> : file?.name}</Text> <Text>({alignment.depth} sequences, {alignment.length} columns)</Text>
      </>
    )
  }

  const [contextMenuEventInfo, setContextMenuEventInfo] = useState<TAVMouseEventInfo>()
  const contextMenu = useMemo((): MenuProps => {
    return createContextMenu({
      isOverviewMode,
      referenceSequenceIndex, 
      annotationFields,
      availableColumnsImported, 
      availableColumnsDerived, 
      otherVisibleColumns, 
      pinnedColumns,
      sortBy, 
      groupBy,
      contextMenuEventInfo: contextMenuEventInfo, 
      paddingXS: antdThemeToken.paddingXS,
      setOtherVisibleColumns,
      setPinnedColumns,
      showArrangeColumns,
      setSortBy,
      showSortByColumns,
      setGroupBy,
      setReferenceSequenceIndex,
      showImportAnnotations,
    })
  }, [
    isOverviewMode,
    referenceSequenceIndex, 
    annotationFields,
    availableColumnsImported, 
    availableColumnsDerived, 
    otherVisibleColumns, 
    pinnedColumns,
    sortBy, 
    groupBy,
    contextMenuEventInfo, 
    antdThemeToken.paddingXS,
  ])

  const sortMenu = {
    items: createSortMenu({
      annotationFields,
      availableColumnsImported,
      availableColumnsDerived,
      sortBy,
      groupBy,
      paddingXS: antdThemeToken.paddingXS,
    }),
    onClick: contextMenu.onClick,
  }

  const groupMenu = {
    items: createGroupByMenu({
      isOverviewMode,
      annotationFields,
      availableColumnsImported,
      availableColumnsDerived,
      groupBy,
    }),
    onClick: contextMenu.onClick,
  }

  const showHideColumnsMenu = {
    items: createShowHideColumnsMenu({
      isOverviewMode,
      annotationFields,
      availableColumnsImported,
      availableColumnsDerived,
      otherVisibleColumns,
      pinnedColumns,
      groupBy,
    }),
    onClick: contextMenu.onClick,
  }

  const handleAlignmentViewerMouseHover = useCallback((info?: TAVMouseEventInfo) => {
    setContextualInfoRef.current?.(info)
    cursorTrackerRef.current?.(info)
  }, [setContextualInfoRef])

  const handleAlignmentViewerBusy = useCallback((isBusy: boolean) => {
    // console.log("handleAlignmentViewerBusy isBusy", isBusy)
    if (isBusy) {
      startSpinning()
    } else {
      stopSpinning()
    }
    // console.log("set spinning true", Date.now())
  }, [startSpinning, stopSpinning])

  const adaptiveContainerRef = useRef<HTMLDivElement>(null)
  const memoizedAlignmentViewer = useMemo(() => {
    if (!fileOrUrl) {
      return undefined
    }
    return (
      <AlignmentViewerAntdWrapper 
        ref={alignmentViewerRef}
        fileOrUrl={fileOrUrl}
        referenceSequenceIndex={referenceSequenceIndex}
        pinnedColumns={pinnedColumns}
        otherVisibleColumns={otherVisibleColumns}
        sortBy={sortBy}
        groupBy={groupBy}
        residueFontFamily="monospace"
        toggles={toggles}
        zoom={zoom}
        isOverviewMode={isOverviewMode}
        alignmentColorPalette={alignmentColorSchema[colorScheme]}
        alignmentColorMode={colorMode}
        positionsToStyle={positionsToStyle}
        hideUnstyledPositions={hideUnstyledPositions}
        darkMode={darkMode}
        adaptiveContainerRef={adaptiveContainerRef}
        onChangeAlignment={handleChangeAlignment}
        onChangeOtherVisibleColumns={handleChangeOtherVisibleColumns}
        onChangePinnedColumns={handleChangePinnedColumns}
        onChangeSortBy={handleChangeSortBy}
        onLoadAlignment={handleLoadAlignment}
        onMouseHover={handleAlignmentViewerMouseHover}
        onContextMenu={setContextMenuEventInfo}
        onBusy={handleAlignmentViewerBusy}
      />
    )
  }, [
    fileOrUrl,
    referenceSequenceIndex,
    otherVisibleColumns,
    pinnedColumns,
    sortBy,
    groupBy,
    toggles,
    zoom,
    isOverviewMode,
    colorScheme,
    colorMode,
    positionsToStyle,
    hideUnstyledPositions,
    darkMode,
    handleLoadAlignment,
    handleChangeAlignment,
    handleChangePinnedColumns,
    handleChangeOtherVisibleColumns,
    handleChangeSortBy,
    handleAlignmentViewerMouseHover,
    handleAlignmentViewerBusy,
  ])

  const contextualInfoComponent = useMemo(() => {
    if (!alignment) {
      return null
    } else  if (contextualInfoContainer === "status bar") {
      return <StatusBar ref={setContextualInfoRef} />
    } else {
      return <ContextualInfoTooltip ref={setContextualInfoRef} />
    }  
  }, [alignment, contextualInfoContainer])

  // console.log("in chrome component: spinning", spinning)
  // console.log("in chrome, spinning =", spinning, Date.now())
  // console.log("render Chrome")
  return (
    <ConfigProvider theme={darkMode ? darkTheme : defaultTheme}>
      <Layout className="chrome-layout" onClickCapture={handleCloseSettingsFromOther}>
        <Flex
          style={{padding: `${antdThemeToken.paddingContentVerticalLG}px ${antdThemeToken.paddingContentHorizontalLG}px`}}
        >
          <Space style={{flexGrow: 1}}>
            <Button type="default" icon={<MenuOutlined />} onClick={showSettings}></Button>
            <Text className="av-alignment-name">{displayFileName}</Text>
          </Space>
          <Space>
            {memoizedAlignmentViewer ? (
              <>
                <ActionMenuButton menu={showHideColumnsMenu}>Show / Hide</ActionMenuButton>
                <ActionMenuButton menu={sortMenu} checked={(sortBy !== undefined) && (sortBy.length > 0)}>Sort</ActionMenuButton>
                <ActionMenuButton menu={groupMenu} checked={groupBy !== false}>
                  {groupBy === false ? "Group" : `${groupCount} Groups`}
                </ActionMenuButton>
              </> 
            ) : null
            }
          </Space>
        </Flex>
        <Dropdown menu={contextMenu} trigger={['contextMenu']} disabled={contextMenu.items?.length === 0} >
          <div ref={adaptiveContainerRef} style={{flexGrow: 1, overflow: "auto", position: "relative"}}>
            {memoizedAlignmentViewer ? (
              <>
                {memoizedAlignmentViewer}
                <CursorTracker ref={cursorTrackerRef} />
              </>
            ) : (
              <Welcome
                style={{flexGrow: 1}}
                fileOrUrl={file || url}
                isLoading={isLoadingAlignment} // {isLoading}
                error={error}
                onChange={handleFileOrUrlChange}
              />
            )
            }
          </div>
        </Dropdown>
        <Flex className="test-spin-wrapper" align='center' justify='center' style={{display: spinning? "flex" : "none"}}>
          <div className="test-spin-mask"/>
          {/* <BusyIndicator style={{width: 300}} /> */}
          <Spin indicator={<LoadingOutlined style={{fontSize: 36}} spin />} />
        </Flex>
        {contextualInfoComponent}
      </Layout>
      <Settings 
        ref={settingsRef} 
        fileOrUrl={file || url} 
        isLoading={isLoadingAlignment}
        error={error}
        zoom={zoom}
        toggles={toggles}
        colorScheme={colorScheme}
        colorMode={colorMode}
        positionsToStyle={positionsToStyle}
        hideUnstyledPositions={hideUnstyledPositions}
        contextualInfoContainer={contextualInfoContainer}
        darkMode={darkMode}
        onFileOrUrlChange={handleFileOrUrlChange}
        onZoomChange={handleZoomChange} //{setZoom}
        onTogglesChange={handleToggleChange}
        onColorSchemeChange={handleColorSchemeChange}
        onColorModeChange={handleColorModeChange}
        onPositionsToStyleChange={handlePositionsToStyleChange}
        onHideUnstyledPositionsChange={setHideUnstyledPositions}
        onContextualInfoContainerChange={handleContextualInfoContainerChange}
        onDarkModeChange={handleDarkModeChange}
      />
      <ArrangeColumns
        ref={arrangeColumnsRef}
        annotationFields={annotationFields}
        availableColumnsImported={availableColumnsImported}
        availableColumnsDerived={availableColumnsDerived}
        pinnedColumns={pinnedColumns ?? []}
        otherVisibleColumns={otherVisibleColumns ?? []}
        onSetOtherVisibleColumns={setOtherVisibleColumns}
        onSetPinnedColumns={setPinnedColumns}
      />
      <SortByColumns
        ref={sortByColumnsRef}
        annotationFields={annotationFields}
        availableColumnsImported={availableColumnsImported}
        availableColumnsDerived={availableColumnsDerived}
        sortBy={sortBy ?? []}
        onSetSortBy={setSortBy}
      />
      <ImportAnnotations
        ref={importAnnotationsRef}
        annotations={alignment?.annotations}
        annotationFields={alignment?.annotationFields}
        onComplete={alignmentViewerRef.current?.updateAnnotations}
        onBusy={handleAlignmentViewerBusy}
      />
    </ConfigProvider>
  )
}