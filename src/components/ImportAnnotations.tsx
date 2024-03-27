import type { CSSProperties, PropsWithChildren, Ref, ReactNode, ChangeEvent } from 'react'
import type { RadioChangeEvent } from 'antd'
import type { TFileOrUrlPickerProps } from '../lib/types'

import { useState, useEffect, useImperativeHandle, forwardRef, Children } from 'react'
import {
  Modal, 
  Flex, 
  Space, 
  Typography, 
  Button, 
  theme as antdTheme, 
  Radio, 
  Input, 
  Card, 
  Select, 
  Divider
} from 'antd'

import FileOrUrlPicker from './FileOrUrlPicker'

const mockData = [
  ["id", "col1", "col2"],
  ["id1", "col1v1", "col2v1"],
  ["id2", "col1v2", "col2v2"],
]

function SelectFileOrUrl({
  file,
  url,
  isLoading = false,
  error,
  onFileChange,
  onUrlChange,
}: TFileOrUrlPickerProps) {
  const [activeTabKey, setActiveTabKey] = useState(url ? "url" : "file")

  const handleTabKeyChange = (activeKey: string) => {
    setActiveTabKey(activeKey)
  }

  return (
    <>
      <Typography.Text>
        Select file or URL to import:
      </Typography.Text>
      <FileOrUrlPicker
        file={file}
        url={url}
        activeTabKey={activeTabKey}
        isLoading={isLoading}
        error={error}
        onFileChange={onFileChange}
        onUrlChange={onUrlChange}
        onTabKeyChange={handleTabKeyChange}
      
      />
    </>
  )
}

function SelectDelimiter({
  delimiter,
  onDelimiterChange,
}: {
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
        <Card style={{overflow: "auto"}}>

        </Card>
      </Flex>
    </>
  )
}

function SelectSequenceIdColumn() {
  return (
    <>
      <Typography.Text>
        Select sequence ID column:&nbsp;
        <Select/>
      </Typography.Text>
      <Typography.Text>
        Preview of imported data
      </Typography.Text>
      <Card style={{overflow: "auto"}}>

      </Card>
    </>
  )
}

export default forwardRef(function ImportAnnotations(props, ref) {
  const [isOpen, setIsOpen] = useState(false)

  useImperativeHandle(ref, () => ({
    open() {
      setIsOpen(true)
    }
  }), [])

  const [file, setFile] = useState<File | undefined>()
  const [url, setUrl] = useState<string | undefined>()
  const [fileContent, setFileContent] = useState(JSON.stringify(mockData))

  const handleFileChange = /*useStartSpinning*/((newFile: File) => {
    if (newFile === file) {
      return
    }
    // setIsLoading(true)
    setFile(newFile)
    setFileContent("")
    if (url) {
      setUrl(undefined)
    }
  })

  const handleUrlChange = /*useStartSpinning*/((newUrl: string) => {
    // setIsLoading(true)
    setUrl(newUrl)
    setFileContent("")
    if (file) {
      setFile(undefined)
    }
  })

  // const [isLoading, setIsLoading] = useState(!!url)
  const isLoading = false // will be using useSWR
  const error = "" // will be using useSWR

  const [activeTabKey, setActiveTabKey] = useState("file")
  const handleTabKeyChange = (activeKey: string) => {
    setActiveTabKey(activeKey)
  }


  const [delimiter, setDelimiter] = useState("\t")
  const pages = [
    <SelectFileOrUrl
      file={file}
      url={url}
      activeTabKey={activeTabKey}
      isLoading={isLoading}
      error={error}
      onTabKeyChange={handleTabKeyChange}
      onFileChange={handleFileChange}
      onUrlChange={handleUrlChange}
    />,
    <SelectDelimiter delimiter={delimiter} onDelimiterChange={setDelimiter} />,
    <SelectSequenceIdColumn/>,
  ]

  const [currentPage, setCurrentPage] = useState(0)

  function handleNext() {
    if (isLoading || (currentPage === pages.length - 1)) {
      return
    }

    setCurrentPage(prevPage => prevPage + 1)
  }

  function handleBack() {
    if (currentPage !== 0) {
      setCurrentPage(prevPage => prevPage - 1)
    }
  }

  function handleOk() {
    setIsOpen(false)
    // onSetSortBy(sortBy)
    // setInitialSortBy([])
  }

  function handleCancel() {
    setIsOpen(false)
    // setSortBy(initialSortBy)
    // setInitialSortBy([])
  }

  function footer(originNode: ReactNode) {
    return (
      <Flex gap="small">
        <Button onClick={handleCancel}>Cancel</Button>
        <div style={{flexGrow: 1}}/>
        {/* {originNode} */}
        {(currentPage > 0) && <Button onClick={handleBack} >Back</Button>}
        {(currentPage < pages.length - 1) && <Button onClick={handleNext} disabled={fileContent === ""} >Next</Button>}
        {(currentPage === pages.length - 1) && <Button>Finish</Button>}
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
