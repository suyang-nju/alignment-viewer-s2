import type { TabsProps, } from 'antd'
import type {
  TFileOrUrlPickerProps,
} from '../lib/types'

import { Tabs, Input, Upload, Alert } from 'antd'

export default function FileOrUrlPicker({
  file,
  url,
  activeTabKey = "file",
  extraTabs,
  isLoading = false,
  error,
  onFileChange,
  onUrlChange,
  onTabKeyChange,
}: TFileOrUrlPickerProps) {
  function handleFileChange(file: File) {
    onFileChange(file)
    return false
  }

  function handleUrlChange(newUrl: string) {
    onUrlChange(newUrl)
  }

  const tabItems: TabsProps["items"] = [
    {
      key: "file", 
      label: "File",
      children: (
        <Upload rootClassName="file_upload" showUploadList={false} beforeUpload={handleFileChange}>
          <Input.Search 
            id="file" 
            enterButton="Browse" 
            value={file?.name} 
            classNames={isLoading && (url === null) && file ? {input: "busy-animation"} : undefined}
            // loading={isLoading && (url === null) && (!!file)}
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
          defaultValue={url ?? ""} 
          classNames={isLoading && (!!url) ? {input: "busy-animation"} : undefined}
          // loading={isLoading && (!!url)}
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