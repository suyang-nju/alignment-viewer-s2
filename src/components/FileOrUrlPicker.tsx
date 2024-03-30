import type { TabsProps, } from 'antd'
import type {
  TFileOrUrlPickerProps,
} from '../lib/types'

import { Tabs, Input, Upload, Alert } from 'antd'

export default function FileOrUrlPicker({
  fileOrUrl,
  activeTabKey = "file",
  extraTabs,
  isLoading = false,
  error,
  onChange,
  onTabKeyChange,
}: TFileOrUrlPickerProps) {
  function handleFileChange(file: File) {
    onChange(file)
    return false
  }

  function handleUrlChange(newUrl: string) {
    if (newUrl) {
      onChange(newUrl)
    }
  }

  const isFile = (fileOrUrl instanceof File)
  const isUrl = (typeof fileOrUrl === "string")

  const tabItems: TabsProps["items"] = [
    {
      key: "file", 
      label: "File",
      children: (
        <Upload rootClassName="file_upload" showUploadList={false} beforeUpload={handleFileChange}>
          <Input.Search 
            id="file" 
            enterButton="Browse" 
            value={isFile ? fileOrUrl.name : undefined} 
            classNames={isLoading && isFile ? {input: "busy-animation"} : undefined}
          />
        </Upload>
      )
    }, {
      key: "url",
      label: "URL",
      children: (
        <Input.Search
          id="url" 
          enterButton="Get" 
          defaultValue={isUrl ? fileOrUrl : ""} 
          classNames={isLoading && isUrl ? {input: "busy-animation"} : undefined}
          onSearch={handleUrlChange} 
        />
      )
    }, 
  ]

  if (extraTabs) {
    tabItems.push(...extraTabs)
  }
  
  return (
    <>
      <Tabs items={tabItems} activeKey={activeTabKey} onChange={onTabKeyChange} />
      {!!error && <Alert message={String(error)} type="error" banner showIcon />}
    </>
  )
}