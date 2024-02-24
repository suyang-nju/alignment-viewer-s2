"use client"

import type { TAlignment, TFormattedSequences, TAlignmentPositionsToStyle, TAlignmentSortParams, TSequence } from '../lib/Alignment'
import type { TAlignmentColorMode } from '../lib/AlignmentColorSchema'
import type { TAlignmentViewerToggles, TContextualInfo, TSetContextualInfo, TTargetCellAndIconInfo } from './AlignmentViewer'
import type { MouseEvent, ReactNode } from 'react'
import type { TargetCellInfo } from '@antv/s2'
import type { RadioChangeEvent, MenuProps } from 'antd'

import { defaultTheme, darkTheme } from '../theme/themeConfig'
import { alignmentColorModes, alignmentColorSchema } from '../lib/AlignmentColorSchema'
import { defaultAlignmentViewerToggles, getAlignmentAnnotationFields, } from './AlignmentViewer'
import { OVERVIEW_MODE_ZOOM } from '../lib/AVTableSheet'
import AlignmentViewerAntdWrapper from './AlignmentViewerAntdWrapper'
import Settings from './Settings'
import Welcome from './Welcome'
import ActionMenuButton from './ActionMenuButton'
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

const getKeys = Object.keys as <T extends object>(obj: T) => Array<keyof T>

function generateRawData(row: {level1: number, level2: number}, col: {level3: number, level4: number}) {
  const res = []

  const rowKeys = getKeys(row)
  const colKeys = getKeys(col)

  let sn = 0
  for (let i = 0; i < row[rowKeys[0]]; i++) {
    for (let j = 0; j < row[rowKeys[1]]; j++) {
      for (let m = 0; m < col[colKeys[0]]; m++) {
        for (let n = 0; n < col[colKeys[1]]; n++) {
          ++sn
          res.push({
            id: `${sn}`,
            actualId: `${sn}`,
            level1: `level1:${i}`,
            level2: `level2:${j}`,
            level3: `level3:${m}`,
            level4: `level4:${n}`,
            sequence: "ACDEFGHIKLMNPQRSTVWY-"[sn % 21].repeat(15),
            links: []
          })
        }
      }
    }
  }

  return res
}

const randomAlignment = /*new Alignment("random", */generateRawData(
  { level1: 100, level2: 10 },
  { level3: 100, level4: 10 },
)/*)*/

async function fetcher(fileOrUrl?:File | string) {
  if (fileOrUrl === "random") {
    return new Promise((resolve) => resolve(new Alignment("random", randomAlignment)))
  } else {
    let text: string
    if (isString(fileOrUrl)) {
      const response = await fetch(fileOrUrl)
      text = await response.text()
    } else {
      // await new Promise((resolve) => setTimeout(resolve, 5000))
      text = await fileOrUrl.text()
    }
    return new Promise((resolve) => resolve(Alignment.fromText(fileOrUrl?.name || "", text)))  
  }
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
  let { data: alignment, error, isLoading, mutate } = useSWR(
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
  return { alignment, error, isLoading, mutate }
}

const StatusBar = forwardRef(function StatusBar(props, ref) {
  const [contextualInfo, setContextualInfo] = useState<TContextualInfo | undefined>(undefined)

  useImperativeHandle(ref, () => (info?: TContextualInfo) => {
    setContextualInfo(info)
  }, [])

  let body
  if (!contextualInfo) {
    body = <div>{"\xa0"}</div>
  } else {
    body = (
      <>
        {(contextualInfo.row || contextualInfo.col) && (
          <Flex key="row-col" className="row-col">
            {contextualInfo.row && <div key="row" className="row">Row {contextualInfo.row}</div>}
            {contextualInfo.col && <div key="col" className="col">Col {contextualInfo.col}</div>}
          </Flex>
        )}
        {contextualInfo.sequenceId && <div key="sequenceId" className="sequence-id">{contextualInfo.sequenceId}</div>}
        {contextualInfo.content}
      </>
    )
  }

  // const antdThemeToken = antdTheme.useToken().token
  const { className, ...otherProps } = props
  return (
    <Flex 
      className={clsx("status-bar", className)} 
      // className={className}
      gap="small"
      {...otherProps} 
      // style={{
      //   fontSize: "12px",
      //   padding: antdThemeToken.paddingXXS,
      //   color: antdThemeToken.colorText, // #565C64,
      //   // backgroundColor: `#f0f0f0`,
      //   borderTop: `${antdThemeToken.colorBorder} 1px solid`,
      //   textOverflow: "ellipsis",
      //   textWrap: "nowrap",
      //   overflow: "hidden",      
      // }}
    >
      {body}
    </Flex>
  )
})

const ContextualInfoTooltip = forwardRef(function ContextualInfoTooltip(props, ref) {
  const [contextualInfo, setContextualInfo] = useState<TContextualInfo | undefined>(undefined)
  const timeoutRef = useRef(0)

  useImperativeHandle(ref, () => debounce((info?: TContextualInfo) => {
    setContextualInfo(info)
  }, 100, {leading: false, trailing: true}), [])

  if (timeoutRef.current) {
    window.clearTimeout(timeoutRef.current)
  }
  
  timeoutRef.current = window.setTimeout(() => { setContextualInfo(undefined) }, 10000)

  if (!!!contextualInfo) {
    return null
  } else {
    let body = (
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
    // let body = (
    //   <>
    //     <div className="contextual-info-tooltip-header">
    //       {(contextualInfo.row || contextualInfo.col) && (
    //         <div key="row-col" className="row-col">
    //           {contextualInfo.row && <div key="row" className="row">Row {contextualInfo.row}</div>}
    //           {contextualInfo.col && <div key="col" className="col">Col {contextualInfo.col}</div>}
    //         </div>
    //       )}
    //     </div>
    //     {contextualInfo.sequenceId && <div key="sequenceId" className="sequence-id">{contextualInfo.sequenceId}</div>}
    //     <div className="contextual-info-tooltip-body">
    //       {contextualInfo.content}
    //     </div>
    //   </>
    // )
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
    console.log("set spin", how === "start")
    // if (how === "start") {
    //   setSpinning(true)
    //   return
    // }
    setSpinning(how === "start")

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
    changeSpinning("start", 50)
  }, [changeSpinning])

  const stopSpinning = useCallback(() => {
    changeSpinning("stop", 500)
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
  const [zoom, setZoom] = useState<number>(12)
  const isOverviewMode: boolean = (zoom <= OVERVIEW_MODE_ZOOM)
  const [toggles, setToggles] = useState<TAlignmentViewerToggles>(defaultAlignmentViewerToggles)

  const [colorScheme, setColorScheme] = useState(Object.keys(alignmentColorSchema)[0])
  const [colorMode, setColorMode] = useState<TAlignmentColorMode>(alignmentColorModes[0])
  const [positionsToStyle, setPositionsToStyle] = useState<TAlignmentPositionsToStyle>("all")
  const [contextualInfoContainer, setContextualInfoContainer] = useState("status bar")
  const [darkMode, setDarkMode] = useState(false)

  const showSettings = (event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation()
    settingsRef.current?.open()
  }

  const handleCloseSettingsFromOther = () => {
    settingsRef.current?.close()
  }

  const handleFileChange = useStartSpinning((newFile: File) => {
    if (newFile === file) {
      return
    }
    setIsLoadingAlignment(true)
    setFile(newFile)
    if (searchParams.get("url")) {
      setSearchParams([])
    }
  })

  const handleUrlChange = useStartSpinning((newUrl: string) => {
    if (newUrl === searchParams.get("url")) {
      return
    }
    setIsLoadingAlignment(true)
    setSearchParams([["url", newUrl]])
    if (file) {
      setFile(undefined)
    }
  })

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
    setPositionsToStyle(value)
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
  const { alignment: newAlignment, error, mutate } = useAlignment(url || file)
  // console.log(
  //   alignment?.uuid.substring(0, 4), alignment?.referenceSequenceIndex,
  //   newAlignment?.uuid.substring(0, 4), newAlignment?.referenceSequenceIndex
  // )

  const [isLoadingAlignment, setIsLoadingAlignment] = useState(!!url)
  const [alignment, setAlignment] = useState<TAlignment | undefined>(undefined)
  const [referenceSequenceIndex, setReferenceSequenceIndex] = useState(0)
  const [availableColumnsImported, setAvailableColumnsImported] = useState<string[]>([])
  const [availableColumnsDerived, setAvailableColumnsDerived] = useState<string[]>([])
  const [showColumns, setShowColumns] = useState<string[]>(availableColumnsImported)
  const [pinnedColumns, setPinnedColumns] = useState(["id"])
  const [sortBy, _setSortBy] = useState<TAlignmentSortParams[]>([])
  const setSortBy = useStartSpinning(_setSortBy)
  const [groupBy, _setGroupBy] = useState<string | undefined>(undefined)
  const setGroupBy = useStartSpinning(_setGroupBy)
  const [collapsedGroups, _setCollapsedGroups] = useState<number[]>([])
  const setCollapsedGroups = useStartSpinning(_setCollapsedGroups)

  const handleGroupBy = useCallback((by: string | undefined) => {
    if (by === groupBy) {
      return
    }
    startSpinning()
    setGroupBy(by)
    setCollapsedGroups([])
  }, [groupBy, setGroupBy, setCollapsedGroups, startSpinning])
  
  useEffect(() => {
    if (!alignment) {
      return
    }

    async function asyncUpdate(alignment: TAlignment, referenceSequenceIndex: number, groupBy: string | undefined) {
      let result: TAlignment = alignment

      if (alignment?.referenceSequenceIndex !== referenceSequenceIndex) {
        const worker = new Worker(new URL('../workers/setReferenceSequence.ts', import.meta.url), { type: 'module' })
        const remoteSetReferenceSequence = await spawn(worker)
        const newAlignment = await remoteSetReferenceSequence(result, referenceSequenceIndex) as TAlignment
        result = {
          ...result, 
          sequences: newAlignment.sequences,
          referenceSequenceIndex: newAlignment.referenceSequenceIndex,
          referenceSequence: newAlignment.referenceSequence,
        }
        await Thread.terminate(remoteSetReferenceSequence)
      }
  
      if (alignment.groupBy !== groupBy) {
        const worker = new Worker(new URL('../workers/groupSequences.ts', import.meta.url), { type: 'module' })
        const remoteGroupSequences = await spawn(worker)
        const newAlignment = await remoteGroupSequences(result, groupBy) as TAlignment
        result = {
          ...result, 
          groupBy: newAlignment.groupBy,
          groups: newAlignment.groups,
          sequences: newAlignment.sequences,
        }
        await Thread.terminate(remoteGroupSequences)
      }

      if (result !== alignment) {
        mutate(result, { populateCache: true, revalidate: false })
      }  
    }

    // console.log("set reference index")
    asyncUpdate(alignment, referenceSequenceIndex, groupBy)
  }, [alignment, referenceSequenceIndex, groupBy, mutate])

  // derived states, needs to be updated / re-initialized upon alignment change
  useEffect(() => {
    if (alignment === newAlignment) {
      // console.log("same alignment")
      return
    }
    const uuid = alignment?.uuid
    setAlignment(newAlignment)
    if (uuid !== newAlignment.uuid) {
      setReferenceSequenceIndex(0)
      const { importedFields, derivedFields } = getAlignmentAnnotationFields(newAlignment)
      setAvailableColumnsImported(importedFields)
      setAvailableColumnsDerived(derivedFields)
      setShowColumns(importedFields)
      setPinnedColumns(["id"])
      setSortBy([])
      setGroupBy(undefined)
      setCollapsedGroups([])
      setIsLoadingAlignment(false)
      settingsRef.current?.close()  
    }
  }, [
    alignment, 
    newAlignment,
    setSortBy,
    setGroupBy,
    setCollapsedGroups,
  ])

  let displayFileName: string | ReactNode = ""
  if (alignment) {
    displayFileName = (
      <>
        <Text strong>{url ? <Link href={url}>{url}</Link> : file?.name}</Text> <Text>({alignment.depth} sequences, {alignment.length} columns)</Text>
      </>
    )
  }

  const [contextMenuTarget, setContextMenuTarget] = useState<TargetCellInfo & {data: unknown}>()
  const contextMenu = useMemo((): MenuProps => {
    return createContextMenu({
      isOverviewMode,
      referenceSequenceIndex: alignment?.referenceSequenceIndex, 
      annotationFields: alignment?.annotationFields,
      availableColumnsImported, 
      availableColumnsDerived, 
      showColumns, 
      pinnedColumns,
      sortBy, 
      groupBy,
      contextMenuTarget, 
      paddingXS: antdThemeToken.paddingXS,
      setShowColumns,
      setPinnedColumns,
      setSortBy,
      setGroupBy: handleGroupBy,
      setReferenceSequenceIndex,
    })
  }, [
    isOverviewMode,
    alignment?.referenceSequenceIndex, 
    alignment?.annotationFields,
    availableColumnsImported, 
    availableColumnsDerived, 
    showColumns, 
    pinnedColumns,
    sortBy, 
    groupBy,
    contextMenuTarget, 
    antdThemeToken.paddingXS,
    handleGroupBy,
    setSortBy
  ])

  const sortMenu = {
    items: createSortMenu({
      annotationFields: alignment?.annotationFields,
      availableColumnsImported,
      availableColumnsDerived,
      sortBy,
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
      showColumns,
      pinnedColumns
    }),
    onClick: contextMenu.onClick,
  }

  const handleAlignmentViewerMouseHover = useCallback((info?: TContextualInfo, eventData?: TargetCellInfo) => {
    setContextualInfoRef.current?.(info, eventData)
  }, [setContextualInfoRef])

  const handleSortActionIconClick = useCallback((field: keyof TSequence) => {
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
    if (alignment?.groups?.length) {
      const collapsibleGroups: number[] = []
      for (let groupIndex = 0; groupIndex < alignment.groups.length; ++groupIndex) {
        if (alignment.groups[groupIndex].members.length > 1) {
          collapsibleGroups.push(groupIndex)
        }
      }
  
      if (collapsibleGroups.length === 0) {
        return
      } else if (collapsedGroups.length === collapsibleGroups.length) {
        setCollapsedGroups([])
      } else {
        if (collapsibleGroups.length > 0) {
          setCollapsedGroups(collapsibleGroups)
        }
      }
    }
  }, [alignment?.groups, collapsedGroups, setCollapsedGroups])

  const handleAlignmentViewerBusy = useCallback((isBusy: boolean) => {
    console.log("before render")
    if (isBusy) {
      startSpinning()
    } else {
      stopSpinning()
    }
    // console.log("set spinning true", Date.now())
  }, [startSpinning, stopSpinning])

  const memoizedAlignmentViewer = useMemo(() => {
    if (!alignment) {
      return undefined
    }
    return (
      <Dropdown menu={contextMenu} trigger={['contextMenu']} disabled={contextMenu.items?.length === 0} >
        <AlignmentViewerAntdWrapper 
          style={{flexGrow: 1, overflow: "auto"}}
          alignment={alignment}
          // referenceSequenceIndex={referenceSequenceIndex}
          showColumns={showColumns}
          pinnedColumns={pinnedColumns}
          sortBy={sortBy}
          collapsedGroups={collapsedGroups}
          residueFontFamily="monospace"
          toggles={toggles}
          zoom={zoom}
          isOverviewMode={isOverviewMode}
          alignmentColorPalette={alignmentColorSchema[colorScheme]}
          alignmentColorMode={colorMode}
          positionsToStyle={positionsToStyle}
          darkMode={darkMode}
          onMouseHover={handleAlignmentViewerMouseHover}
          onSortActionIconClick={handleSortActionIconClick}
          onExpandCollapseGroupIconClick={handleExpandCollapseGroupIconClick}
          onExpandCollapseAllGroupsIconClick={handleExpandCollapseAllGroupsIconClick}
          onContextMenu={setContextMenuTarget}
          onBusy={handleAlignmentViewerBusy}
        />
      </Dropdown>
    )
  }, [
    alignment,
    // referenceSequenceIndex, 
    showColumns,
    pinnedColumns,
    sortBy,
    collapsedGroups,
    toggles,
    zoom,
    isOverviewMode,
    colorScheme,
    colorMode,
    positionsToStyle,
    darkMode,
    contextMenu,
    handleAlignmentViewerMouseHover,
    handleSortActionIconClick,
    handleExpandCollapseGroupIconClick,
    handleExpandCollapseAllGroupsIconClick,
    handleAlignmentViewerBusy,
  ])


  console.log("in chrome component: spinning", spinning)
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
                <ActionMenuButton menu={groupMenu} checked={!!(alignment?.groupBy)}>
                  {((alignment?.groupBy)) ? `${alignment.groups.length} Groups` :"Group"}
                </ActionMenuButton>
              </> 
            ) : null
            }
          </Space>
        </Flex>
        {memoizedAlignmentViewer || (
          <Welcome
            style={{flexGrow: 1}}
            file={file}
            isLoading={isLoadingAlignment} // {isLoading}
            error={error}
            onFileChange={handleFileChange}
            onUrlChange={handleUrlChange}
          />
        )
        }
        <Flex className="test-spin-wrapper" align='center' justify='center' style={{display: spinning? "flex" : "none"}}>
          <Spin indicator={<LoadingOutlined style={{fontSize: 36}} spin />} />
        </Flex>
        {(contextualInfoContainer === "status bar") ?
          <StatusBar ref={(setContent: TSetContextualInfo) => {setContextualInfoRef.current = setContent}} /> :
          <ContextualInfoTooltip ref={(setContent: TSetContextualInfo) => {setContextualInfoRef.current = setContent}} />
        }
      </Layout>
      <Settings 
        ref={settingsRef} 
        file={file} 
        alignment={alignment}
        isLoading={isLoadingAlignment} // {isLoading}
        error={error}
        zoom={zoom}
        toggles={toggles}
        colorScheme={colorScheme}
        colorMode={colorMode}
        positionsToStyle={positionsToStyle}
        contextualInfoContainer={contextualInfoContainer}
        darkMode={darkMode}
        onFileChange={handleFileChange}
        onUrlChange={handleUrlChange}
        onZoomChange={handleZoomChange} //{setZoom}
        onTogglesChange={handleToggleChange}
        onColorSchemeChange={handleColorSchemeChange}
        onColorModeChange={handleColorModeChange}
        onPositionsToStyleChange={handlePositionsToStyleChange}
        onContextualInfoContainerChange={handleContextualInfoContainerChange}
        onDarkModeChange={handleDarkModeChange}
      />
    </ConfigProvider>
  )
}