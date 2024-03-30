import type { CSSProperties, PropsWithChildren, Ref, ReactNode, ChangeEvent, MouseEvent } from 'react'
import type { RadioChangeEvent } from 'antd'
import type { TFileOrUrlPickerProps } from '../lib/types'

import { useState, useEffect, useMemo, useRef, useImperativeHandle, forwardRef } from 'react'
import {
  Modal, 
  Flex, 
  Space, 
  Typography, 
  Button, 
  Radio, 
  Input, 
  Card, 
  Select, 
} from 'antd'
import Papa from 'papaparse'
import { spawn, Thread, Worker } from "threads"

import FileOrUrlPicker from './FileOrUrlPicker'


function PreviewCSV({
  data,
  highlightColumn,
  onColumnClick,
}: {
  data: Record<string, string>[],
  highlightColumn?: string,
  onColumnClick?: (column: string) => void,
}) {
  const header = []
  const rows = []
  if (data.length) {
    const columns = Object.keys(data[0])
    for (let j = 0; j < columns.length; ++j) {
      const className = (columns[j] === highlightColumn) ? "highlight": undefined
      header.push(<th key={j} data-column={columns[j]} className={className}>{columns[j]}</th>)
    }

    for (let i = 0; i < data.length; ++i) {
      const cells = []
      for (let j = 0; j < columns.length; ++j) {
        const className = (columns[j] === highlightColumn) ? "highlight": undefined
        cells.push(<td key={j} data-column={columns[j]} className={className}>{data[i][columns[j]]}</td>)
      }
      rows.push(<tr key={i}>{cells}</tr>)
    }
  }

  function handleClick(event: MouseEvent) {
    if (onColumnClick && (event.target instanceof HTMLElement)) {
      const col = event.target.dataset.column
      if (col) {
        onColumnClick(col)
      }
    }
  }

  return (
    <div className="preview-csv">
      <table onClick={handleClick}>
        <thead><tr>{header}</tr></thead>
        <tbody>{rows}</tbody>
      </table>
    </div>
  )
}

function SelectFileOrUrl({
  fileOrUrl,
  isLoading = false,
  error,
  onChange,
}: TFileOrUrlPickerProps) {
  const [activeTabKey, setActiveTabKey] = useState((fileOrUrl && (typeof fileOrUrl === "string")) ? "url" : "file")

  const handleTabKeyChange = (activeKey: string) => {
    setActiveTabKey(activeKey)
  }

  return (
    <div>
      <Typography.Text>
        Select file or URL to import:
      </Typography.Text>
      <FileOrUrlPicker
        fileOrUrl={fileOrUrl}
        activeTabKey={activeTabKey}
        isLoading={isLoading}
        error={error}
        onChange={onChange}
        onTabKeyChange={handleTabKeyChange}
      />
    </div>
  )
}

function SelectDelimiter({
  data,
  delimiter,
  onDelimiterChange,
}: {
  data: Record<string, string>[],
  delimiter: string,
  onDelimiterChange: (delimiter: string) => void
}) {
  let radioValue = delimiter
  let otherValue = ""
  if (!["\t", ",", " ", ";"].includes(radioValue)) {
    radioValue = "other"
    otherValue = delimiter
  }

  const [other, setOther] = useState(otherValue)
  function handleOtherInputChange(event: ChangeEvent<HTMLInputElement>) {
    setOther(event.target.value)
    onDelimiterChange(event.target.value)
  }

  function handleDelimiterRadioChange(event: RadioChangeEvent) {
    if (event.target.value === "other") {
      onDelimiterChange(other)
    } else {
      onDelimiterChange(event.target.value)
    }
  }

  return (
    <>
      <Flex vertical gap="small">
        <Typography.Text>
          Select the delimiter:
        </Typography.Text>
        <Radio.Group onChange={handleDelimiterRadioChange} value={radioValue}>
          <Space size="small" wrap style={{justifyContent: "space-between"}} >
            <div><Radio value={"\t"}>Tab</Radio></div>
            <div><Radio value={","}>Comma</Radio></div>
            <div><Radio value={" "}>Space</Radio></div>
            <div><Radio value={";"}>Semicolon</Radio></div>
            <div style={{whiteSpace: "nowrap"}}>
              <Radio value={"other"}>Other:&nbsp;
                <Input defaultValue={other} onChange={handleOtherInputChange} htmlSize={1} style={{width: "unset"}} />
              </Radio>
            </div>
          </Space>
        </Radio.Group>
      </Flex>
      <Flex vertical gap="small">
        <Typography.Text>
          Preview of imported data
        </Typography.Text>
        <PreviewCSV data={data} />
      </Flex>
    </>
  )
}

function SelectSequenceIdColumn({
  data,
  sequenceIdColumn,
  onSequenceIdColumnChange,
}: {
  data: Record<string, string>[],
  sequenceIdColumn?: string,
  onSequenceIdColumnChange: (sequenceIdColumn: string) => void
}) {
  if (data.length === 0) {
    return
  }

  const options = []
  for (const col of Object.keys(data[0])) {
    options.push({value: col, label: col})
  }
  return (
    <>
      <Flex vertical gap="small">
        <Typography.Text>
          Select sequence ID column:&nbsp;
          <Select
            value={sequenceIdColumn}
            options={options}
            popupMatchSelectWidth={false}
            onChange={onSequenceIdColumnChange}
          />
        </Typography.Text>
      </Flex>
      <Flex vertical gap="small">
        <Typography.Text>
          Preview of imported data
        </Typography.Text>
        <PreviewCSV data={data} highlightColumn={sequenceIdColumn} onColumnClick={onSequenceIdColumnChange} />
      </Flex>
    </>
  )
}

export default forwardRef(function ImportAnnotations({
  onComplete
}: {
  onComplete: (data: Record<string, string[]>) => void
}, ref) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(0)

  function handleNext() {
    if (currentPage === pages.length - 1) {
      return
    }

    setCurrentPage(prevPage => prevPage + 1)
  }

  function handleBack() {
    if (currentPage !== 0) {
      setCurrentPage(prevPage => prevPage - 1)
    }
  }


  const [fileOrUrl, setFileOrUrl] = useState<File | string | undefined>()
  const [previewContent, setPreviewContent] = useState("")
  const [delimiter, setDelimiter] = useState("")
  const [sequenceIdColumn, setSequenceIdColumn] = useState<string | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const workerRef = useRef<Worker | undefined>(undefined)
  
  useImperativeHandle(ref, () => ({
    open() {
      setIsOpen(true)
      setCurrentPage(0)
      setFileOrUrl(undefined)
      setPreviewContent("")
      setSequenceIdColumn(undefined)
      setIsLoading(false)
      setError("")
    }
  }), [])

  const handleFileOrUrlChange = /*useStartSpinning*/((newFileOrUrl: File | string) => {
    if (newFileOrUrl === fileOrUrl) {
      return
    }
    // setIsLoading(true)
    setFileOrUrl(newFileOrUrl)
    setPreviewContent("")
  })

  useEffect(() => {
    if (!fileOrUrl) {
      return
    }

    async function asyncUpdate() {
      setIsLoading(true)
      setPreviewContent("")
      setDelimiter("")
      setSequenceIdColumn(undefined)
  
      if (workerRef.current) {
        await Thread.terminate(workerRef.current)
        workerRef.current = undefined
      }
      const worker = await spawn(new Worker(new URL('../workers/ImportAnnotationFile.ts', import.meta.url), { type: 'module' }))
      workerRef.current = worker
      const c = await worker.getPreviewContent(fileOrUrl)
      setPreviewContent(c)
      setCurrentPage(1)
      setIsLoading(false)
    }

    asyncUpdate()
  }, [fileOrUrl])

  const previewData = useMemo(() => {
    if (!previewContent) {
      return []
    }

    const result = Papa.parse(previewContent, {header: true, delimiter})
    if (!delimiter) {
      setDelimiter(result.meta.delimiter)
    }

    const data = result.data as Record<string, string>[]
    if (data.length > 0) {
      setSequenceIdColumn(Object.keys(data[0])[0])
    }
    return data
  }, [previewContent, delimiter])

  const [activeTabKey, setActiveTabKey] = useState("file")
  const handleTabKeyChange = (activeKey: string) => {
    setActiveTabKey(activeKey)
  }

  const pages = [
    <SelectFileOrUrl
      fileOrUrl={fileOrUrl}
      activeTabKey={activeTabKey}
      isLoading={isLoading}
      error={error}
      onTabKeyChange={handleTabKeyChange}
      onChange={handleFileOrUrlChange}
    />,
    <SelectDelimiter data={previewData} delimiter={delimiter} onDelimiterChange={setDelimiter} />,
    <SelectSequenceIdColumn data={previewData} sequenceIdColumn={sequenceIdColumn} onSequenceIdColumnChange={setSequenceIdColumn} />,
  ]

  function handleOk() {
    setIsOpen(false)

    async function asyncUpdate() {
      if (workerRef.current) {
        const result = await workerRef.current.parse(delimiter)
        await Thread.terminate(workerRef.current)
        workerRef.current = undefined
        onComplete(result)
      }
    }

    asyncUpdate()
  }

  function handleCancel() {
    setIsOpen(false)
  }

  function footer(originNode: ReactNode) {
    return (
      <Flex gap="small">
        <Button onClick={handleCancel}>Cancel</Button>
        <div style={{flexGrow: 1}}/>
        {/* {originNode} */}
        {(currentPage > 0) && <Button onClick={handleBack} >Back</Button>}
        {(currentPage < pages.length - 1) && <Button onClick={handleNext} disabled={previewData.length === 0} >Next</Button>}
        {(currentPage === pages.length - 1) && <Button onClick={handleOk} >Finish</Button>}
      </Flex>
    )
  }

  return (
    <Modal
      title="Import Annotations"
      open={isOpen}
      destroyOnClose={true}
      closable={false}
      footer={footer}
      onOk={handleOk}
      onCancel={handleCancel}
    >
      <Flex vertical gap="large" >
        {pages[currentPage]}
      </Flex>
    </Modal>
  )
})
