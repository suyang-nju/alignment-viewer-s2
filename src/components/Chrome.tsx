import type {
  TAlignment, 
  TAlignmentPositionsToStyle, 
  TAlignmentSortParams, 
  TSequenceGroup,
  TAlignmentColorMode,
  TAlignmentViewerToggles, 
  TContextualInfo, 
  TSetContextualInfo, 
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
import { getAlignmentAnnotationFields } from '../lib/alignment'
import { defaultAlignmentViewerToggles, } from './AlignmentViewer'
import AlignmentViewerAntdWrapper from './AlignmentViewerAntdWrapper'
import Settings from './Settings'
import Welcome from './Welcome'
import ActionMenuButton from './ActionMenuButton'
import ArrangeColumns from './ArrangeColumns'
import SortByColumns from './SortByColumns'
import ImportAnnotations from './ImportAnnotations'
import { createContextMenu, createSortMenu, createGroupByMenu, createShowHideColumnsMenu } from '../lib/menu'

import { debounce, isString } from 'lodash'
// import useSWRImmutable from 'swr/immutable'
import useSWR from 'swr'
import { useSearchParams, Link } from 'react-router-dom'
import { useState, useEffect, useImperativeHandle, useRef, forwardRef, useMemo, useCallback } from 'react'
import { 
  ConfigProvider, theme as antdTheme, Flex, Space, Button, 
  Tooltip, Tag, Typography, Layout, Spin, Dropdown, Empty,
} from 'antd'
import { MenuOutlined, LoadingOutlined } from '@ant-design/icons'
import clsx from 'clsx'
import { spawn, Thread, Worker } from 'threads'
// const { spawn, Thread, Worker } = require('threads')


// eslint-disable-next-line  @typescript-eslint/no-explicit-any
function BusyIndicator(props: Record<string, any>) {
  return <div className='busy-indicator busy-animation' {...props} />
}

async function localFetcher(fileOrUrl?:File | string) {
  // console.log("Begin fetching in localFetcher", Date.now())
  const worker = new Worker(new URL('../workers/fetchAlignment.ts', import.meta.url), { type: 'module' })
  const remoteFetcher = await spawn(worker)
  const alignment = await remoteFetcher(fileOrUrl)
  await Thread.terminate(remoteFetcher)
  // window.alignment = alignment
  // console.log("Done fetching in localFetcher", typeof alignment, Date.now())
  return alignment
}

function useAlignment(file?: File | string) {
  // console.log("Begin fetching in useAlignment", Date.now())
  let { data: alignment, error, isLoading } = useSWR(
    file, 
    localFetcher/*fetcher*/, 
    {
      keepPreviousData: true,
      compare: (a, b) => (a === b),
      revalidateIfStale: false,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    },
  )

  if (!isLoading && !error && !!alignment) {
    if ((alignment as TAlignment).depth === 0) {
      error = "Alignment is empty"
      alignment = undefined
    }
  }
  // console.log("Done fetching in useAlignment", isLoading, error, typeof alignment, Date.now())
  return { alignment, error, isLoading }
}

const StatusBar = forwardRef(function StatusBar(props, ref) {
  const [contextualInfo, setContextualInfo] = useState<TContextualInfo | undefined>(undefined)

  useImperativeHandle(ref, () => (info?: TAVMouseEventInfo) => {
    setContextualInfo(info?.contextualInfo)
  }, [])

  const body: ReactNode[] = []
  if (contextualInfo) {
    if (contextualInfo.row || contextualInfo.col) { 
      body.push(
        <Flex key="row-col" className="row-col">
          {contextualInfo.row && <div key="row" className="row">Row {contextualInfo.row}</div>}
          {contextualInfo.col && <div key="col" className="col">Col {contextualInfo.col}</div>}
        </Flex>
      )
    }
    
    if (contextualInfo.sequenceId) {
      body.push(
        <div key="sequenceId" className="sequence-id">{contextualInfo.sequenceId}</div>
      )
    }
    
    for (const node of contextualInfo.content) {
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
  const [contextualInfo, setContextualInfo] = useState<TContextualInfo | undefined>(undefined)
  const timeoutRef = useRef(0)

  useImperativeHandle(ref, () => debounce((info?: TAVMouseEventInfo) => {
    setContextualInfo(info?.contextualInfo)
  }, 100, {leading: false, trailing: true}), [])

  if (timeoutRef.current) {
    window.clearTimeout(timeoutRef.current)
  }
  
  timeoutRef.current = window.setTimeout(() => { setContextualInfo(undefined) }, 10000)

  if (!contextualInfo) {
    return null
  } else {
    const body = (
      <>
        <div className="contextual-info-tooltip-header">
          {(contextualInfo.row || contextualInfo.col) && (
            <div key="row-col" className="row-col">
              {contextualInfo.row && <div key="row" className="row">Row {contextualInfo.row}</div>}
              {contextualInfo.col && <div key="col" className="col">Col {contextualInfo.col}</div>}
            </div>
          )}
          {contextualInfo.sequenceId && <div key="sequenceId" className="sequence-id">{contextualInfo.sequenceId}</div>}
        </div>
        <div className="contextual-info-tooltip-body">
          {contextualInfo.content}
        </div>
      </>
    )

    const { className, ...otherProps } = props
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
          key={contextualInfo.key}
          style={{
            pointerEvents: "none",
            position: "absolute",
            left: contextualInfo.anchorX,
            top: contextualInfo.anchorY,
            width: contextualInfo.anchorWidth,
            height: contextualInfo.anchorHeight,
            visibility: "hidden",
          }}
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

  const settingsRef = useRef<{ open: () => void, close: () => void }>(null)
  const setContextualInfoRef = useRef<undefined | TSetContextualInfo>(undefined)
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
  const { alignment: newAlignment, error } = useAlignment(url || file)
  // console.log(
  //   alignment?.uuid.substring(0, 4), alignment?.referenceSequenceIndex,
  //   newAlignment?.uuid.substring(0, 4), newAlignment?.referenceSequenceIndex
  // )

  const [isLoadingAlignment, setIsLoadingAlignment] = useState(!!url)
  const [alignment, setAlignment] = useState<TAlignment | undefined>(undefined)
  const [referenceSequenceIndex, setReferenceSequenceIndex] = useState(0)
  const [availableColumnsImported, setAvailableColumnsImported] = useState<string[]>([])
  const [availableColumnsDerived, setAvailableColumnsDerived] = useState<string[]>([])
  const [pinnedColumns, setPinnedColumns] = useState<string[]>([])
  const [otherVisibleColumns, setOtherVisibleColumns] = useState<string[]>(availableColumnsImported.filter((col) => !pinnedColumns.includes(col)))
  const [sortBy, setSortBy] = useState<TAlignmentSortParams[]>([])
  const [groupBy, setGroupBy] = useState<string | number | undefined>(undefined)
  const [groupCount, setGroupCount] = useState(0)
  const [collapsibleGroups, setCollapsibleGroups] = useState<number[]>([])
  const [collapsedGroups, setCollapsedGroups] = useState<number[]>([])

  const handleFileOrUrlChange = /*useStartSpinning*/((newFileOrUrl: File | string) => {
    if (newFileOrUrl === file) {
      return
    }
    
    const currentUrl = searchParams.get("url")
    if (newFileOrUrl === currentUrl) {
      return
    }

    setIsLoadingAlignment(true)

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

  const handleGroupBy = useCallback((by: string | number | undefined) => {
    if (by === groupBy) {
      return
    }
    startSpinning()
    setGroupBy(by)
    setCollapsedGroups([])
  }, [groupBy, setGroupBy, setCollapsedGroups, startSpinning])

  // derived states, needs to be updated / re-initialized upon alignment change
  useEffect(() => {
    if (alignment === newAlignment) {
      // console.log("same alignment")
      return
    }
    const uuid = alignment?.uuid
    setAlignment(newAlignment)
    if (uuid !== newAlignment.uuid) {
      const { importedFields, derivedFields } = getAlignmentAnnotationFields(newAlignment)
      const newPinned = ["id"]
      const newOtherVisibleColumns = importedFields.filter((col) => !newPinned.includes(col))
      setReferenceSequenceIndex(0)
      setAvailableColumnsImported(importedFields)
      setAvailableColumnsDerived(derivedFields)
      setPinnedColumns(newPinned)
      setOtherVisibleColumns(newOtherVisibleColumns)
      setSortBy([])
      setGroupBy(undefined)
      setCollapsedGroups([])
      setIsLoadingAlignment(false)
      settingsRef.current?.close()  
    }
  }, [
    alignment, 
    newAlignment,
    setReferenceSequenceIndex,
    setSortBy,
    setGroupBy,
    setCollapsedGroups,
  ])

  let displayFileName: string | ReactNode = ""
  if (alignment) {
    displayFileName = (
      <>
        <Text strong>{url ? <Link to={url}>{url}</Link> : file?.name}</Text> <Text>({alignment.depth} sequences, {alignment.length} columns)</Text>
      </>
    )
  }

  const [contextMenuTarget, setContextMenuTarget] = useState<TAVMouseEventInfo>()
  const contextMenu = useMemo((): MenuProps => {
    return createContextMenu({
      isOverviewMode,
      referenceSequenceIndex, 
      annotationFields: alignment?.annotationFields,
      availableColumnsImported, 
      availableColumnsDerived, 
      otherVisibleColumns, 
      pinnedColumns,
      sortBy, 
      groupBy,
      contextMenuTarget, 
      paddingXS: antdThemeToken.paddingXS,
      setOtherVisibleColumns,
      setPinnedColumns,
      showArrangeColumns,
      setSortBy,
      showSortByColumns,
      setGroupBy: handleGroupBy,
      setReferenceSequenceIndex,
      showImportAnnotations,
    })
  }, [
    isOverviewMode,
    referenceSequenceIndex, 
    alignment?.annotationFields,
    availableColumnsImported, 
    availableColumnsDerived, 
    otherVisibleColumns, 
    pinnedColumns,
    sortBy, 
    groupBy,
    contextMenuTarget, 
    antdThemeToken.paddingXS,
    handleGroupBy,
    setReferenceSequenceIndex,
    setSortBy,
  ])

  const sortMenu = {
    items: createSortMenu({
      annotationFields: alignment?.annotationFields,
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
      annotationFields: alignment?.annotationFields,
      availableColumnsImported,
      availableColumnsDerived,
      groupBy,
    }),
    onClick: contextMenu.onClick,
  }

  const showHideColumnsMenu = {
    items: createShowHideColumnsMenu({
      isOverviewMode,
      annotationFields: alignment?.annotationFields,
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
  }, [setContextualInfoRef])

  const handleSortActionIconClick = useCallback((field: string) => {
    // cycle between "asc" and "desc"
    if ((sortBy.length !== 1) || (sortBy[0].field !== field) || (sortBy[0].order === "desc")) {
      setSortBy([{field, order: "asc"}])
    } else { // sortBy[0].field === "asc"
      setSortBy([{field, order: "desc"}])
    }
    
    // cycle among "asc", "desc" and unsorted
    // if ((sortBy.length !== 1) || (sortBy[0].field !== field)) {
    //   setSortBy([{field, order: "asc"}])
    // } else if (sortBy[0].order === "asc") {
    //   setSortBy([{field, order: "desc"}])
    // } else { // sortBy[0].field === "desc"
    //   setSortBy([])
    // }
  }, [sortBy, setSortBy])

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

  const handleAlignmentGroupsChanged = useCallback((groups: TSequenceGroup[]) => {
    setGroupCount(groups.length)

    const collapsibleGroups: number[] = []
    if (groups.length) {
      for (let groupIndex = 0; groupIndex < groups.length; ++groupIndex) {
        if (groups[groupIndex].members.length > 1) {
          collapsibleGroups.push(groupIndex)
        }
      }
    }
    setCollapsibleGroups(collapsibleGroups)
  }, [])

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
    if (!alignment) {
      return undefined
    }
    return (
      <AlignmentViewerAntdWrapper 
        alignment={alignment}
        referenceSequenceIndex={referenceSequenceIndex}
        pinnedColumns={pinnedColumns}
        otherVisibleColumns={otherVisibleColumns}
        sortBy={sortBy}
        groupBy={groupBy}
        collapsedGroups={collapsedGroups}
        residueFontFamily="monospace"
        toggles={toggles}
        zoom={zoom}
        isOverviewMode={isOverviewMode}
        alignmentColorPalette={alignmentColorSchema[colorScheme]}
        alignmentColorMode={colorMode}
        positionsToStyle={positionsToStyle}
        hideUnstyledPositions={hideUnstyledPositions}
        highlightCurrentSequence={true}
        darkMode={darkMode}
        adaptiveContainerRef={adaptiveContainerRef}
        onMouseHover={handleAlignmentViewerMouseHover}
        onSortActionIconClick={handleSortActionIconClick}
        onExpandCollapseGroupIconClick={handleExpandCollapseGroupIconClick}
        onExpandCollapseAllGroupsIconClick={handleExpandCollapseAllGroupsIconClick}
        onContextMenu={setContextMenuTarget}
        onBusy={handleAlignmentViewerBusy}
        onGroupsChanged={handleAlignmentGroupsChanged}
      />
    )
  }, [
    alignment,
    referenceSequenceIndex,
    otherVisibleColumns,
    pinnedColumns,
    sortBy,
    groupBy,
    collapsedGroups,
    toggles,
    zoom,
    isOverviewMode,
    colorScheme,
    colorMode,
    positionsToStyle,
    hideUnstyledPositions,
    darkMode,
    handleAlignmentViewerMouseHover,
    handleSortActionIconClick,
    handleExpandCollapseGroupIconClick,
    handleExpandCollapseAllGroupsIconClick,
    handleAlignmentGroupsChanged,
    handleAlignmentViewerBusy,
  ])

  const contextualInfoComponent = useMemo(() => {
    if (!alignment) {
      return null
    } else  if (contextualInfoContainer === "status bar") {
      return <StatusBar ref={(setContent: TSetContextualInfo) => {setContextualInfoRef.current = setContent}} />
    } else {
      return <ContextualInfoTooltip ref={(setContent: TSetContextualInfo) => {setContextualInfoRef.current = setContent}} />
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
                <ActionMenuButton menu={sortMenu} checked={sortBy.length > 0}>Sort</ActionMenuButton>
                <ActionMenuButton menu={groupMenu} checked={groupBy !== undefined}>
                  {groupBy === undefined ? "Group" : `${groupCount} Groups`}
                </ActionMenuButton>
              </> 
            ) : null
            }
          </Space>
        </Flex>
        <Dropdown menu={contextMenu} trigger={['contextMenu']} disabled={contextMenu.items?.length === 0} >
          <div ref={adaptiveContainerRef} style={{flexGrow: 1, overflow: "auto"}}>
            {memoizedAlignmentViewer ? (
                memoizedAlignmentViewer
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
        isLoading={isLoadingAlignment} // {isLoading}
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
        annotationFields={alignment?.annotationFields}
        availableColumnsImported={availableColumnsImported}
        availableColumnsDerived={availableColumnsDerived}
        pinnedColumns={pinnedColumns}
        otherVisibleColumns={otherVisibleColumns}
        onSetOtherVisibleColumns={setOtherVisibleColumns}
        onSetPinnedColumns={setPinnedColumns}
      />
      <SortByColumns
        ref={sortByColumnsRef}
        annotationFields={alignment?.annotationFields}
        availableColumnsImported={availableColumnsImported}
        availableColumnsDerived={availableColumnsDerived}
        sortBy={sortBy}
        onSetSortBy={setSortBy}
      />
      <ImportAnnotations
        ref={importAnnotationsRef}
      />
    </ConfigProvider>
  )
}