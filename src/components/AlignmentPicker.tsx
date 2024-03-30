import type { TabsProps, } from 'antd'
import type { TAlignmentPickerProps } from '../lib/types'

import { Typography, Button, Flex, Space } from 'antd'
import clsx from 'clsx'
import { Link } from 'react-router-dom'
import { useState } from 'react'

import FileOrUrlPicker from './FileOrUrlPicker'

const exampleAlignments = [
  {
    name: "1M sequences",
    url: "random",
  }, {
    name: "alpha-amylase",
    url: import.meta.env.BASE_URL + "alpha-amylase_WT_b0.5.a2m"
  }
]

export default function AlignmentPicker({
  fileOrUrl,
  isLoading = false,
  error,
  className,
  style,
  onChange,
}: TAlignmentPickerProps) {
  const [activeTabKey, setActiveTabKey] = useState((fileOrUrl && (typeof fileOrUrl === "string")) ? "url" : "file")

  const handleTabKeyChange = (activeKey: string) => {
    setActiveTabKey(activeKey)
  }

  const showExamplesTab = () => {
    setActiveTabKey("examples")
  }

  const tabItems: TabsProps["items"] = [
    {
      key: "examples", 
      label: "Examples", 
      children: (
        <Space direction="vertical" style={{width: "100%"}}>
          {
            exampleAlignments.map(
              ({name, url}: {name: string, url: string}) => (
                <div key={url} className={clsx(isLoading && (url === fileOrUrl) && "busy-animation")} >
                  <Button type="link" size="small" >
                    <Link to={`./?url=${url}`}>{`${name}`}</Link>
                  </Button>
                </div>
              )
            )
          }
        </Space>
      ), 
    }, 
  ]
  
  return (
    <Flex vertical className={className} style={style} >
      <Typography.Text>
        Open an alignment or try the <Button type="link" style={{padding: 0}} onClick={showExamplesTab}>examples</Button> below.
      </Typography.Text>
      {/* <Typography.Text type="success" italic>
        No data will be sent to the server.
      </Typography.Text> */}
      <FileOrUrlPicker
        fileOrUrl={fileOrUrl}
        extraTabs={tabItems}
        activeTabKey={activeTabKey}
        isLoading={isLoading}
        error={error}
        className={className}
        style={style}
        onChange={onChange}
        onTabKeyChange={handleTabKeyChange}
      />
    </Flex>
  )
}