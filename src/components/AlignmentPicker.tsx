import type { TabsProps, } from 'antd'
import type { CSSProperties } from 'react'

import { 
  theme as antdTheme, Typography, Button, Tabs, 
  Input, Flex, Space, Upload, Spin, Alert, 
} from 'antd'
import { Keyframes, useStyleRegister } from '@ant-design/cssinjs'
import clsx from 'clsx'
import { Link, useSearchParams } from 'react-router-dom'
import { transparentize } from 'color2k'
import { useState } from 'react'


export type TAlignmentPickerProps = {
  file?: File,
  isLoading: boolean,
  error: unknown,
  className?: string,
  style?: CSSProperties,
  onFileChange: (file: File) => void,
  onUrlChange: (url: string) => void,
}


const exampleAlignments = [
  {
    name: "1M sequences",
    url: "random",
  }, {
    name: "β-lactamase",
    url: "https://fast.alignmentviewer.org/7fa1c5691376beab198788a726917d48_b0.4.a2m",
  }, {
    name: "SARS-CoV-2 Spike",
    url: "https://fast.alignmentviewer.org/Spike_Full_f05_m05_t08.a2m",
  }
]

function useAnimatedBackground() {
  const { theme, token } = antdTheme.useToken()

  const color1 = transparentize(token.colorPrimary, 0.7)
  const color2 = transparentize(token.colorPrimary, 0.85)
  const animatedBackgroundHeight = token.controlHeight
  const animatedBackgroundWidth = animatedBackgroundHeight * 2 / Math.sqrt(3)
  const loadingAnimation = new Keyframes('loading-animation', {
    to: {
      "background-position": `${animatedBackgroundWidth}px 50%`
    }
  })

  useStyleRegister(
    { theme, token, path: [""]},
    () => [
      loadingAnimation, 
      {
        ".loading-animation": {
          backgroundImage: `linear-gradient(-60deg,${color1} 0%, ${color1} 33.3%, ${color2} 33.3%, ${color2} 66.7%, ${color1} 66.7%)`,
          backgroundSize: `${animatedBackgroundWidth}px ${animatedBackgroundHeight}px`,
          backgroundOrigin: "border-box", 
          animation: '1s linear infinite loading-animation',
        }
      }
    ],
  )
}

export default function AlignmentPicker({
  file,
  isLoading = false,
  error,
  className,
  style,
  onFileChange,
  onUrlChange,
}: TAlignmentPickerProps) {
  const [searchParams, ] = useSearchParams()
  const currentUrl = searchParams.get("url")
  const [activeTabKey, setActiveTabKey] = useState(currentUrl ? "url" : "file")
  useAnimatedBackground()

  const handleTabKeyChange = (activeKey: string) => {
    setActiveTabKey(activeKey)
  }

  const showExamplesTab = () => {
    setActiveTabKey("examples")
  }

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
            classNames={isLoading && (currentUrl === null) && file ? {input: "loading-animation"} : undefined}
            // loading={isLoading && (currentUrl === null) && (!!file)}
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
          defaultValue={currentUrl ?? ""} 
          classNames={isLoading && (!!currentUrl) ? {input: "loading-animation"} : undefined}
          // loading={isLoading && (!!currentUrl)}
          onSearch={handleUrlChange} 
        />
      )
    }, {
      key: "examples", 
      label: "Examples", 
      children: (
        <Space direction="vertical">
          {
            exampleAlignments.map(
              ({name, url}: {name: string, url: string}) => (
                <Button
                  key={url} 
                  type="link" 
                  size="small" 
                  className={clsx(isLoading && (url === currentUrl) && "loading-animation")}
                >
                  <Link to={`/?url=${url}`}>{`${name}`}</Link>
                </Button>
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
        Open an alignment or try one of the <Button type="link" style={{padding: 0}} onClick={showExamplesTab}>examples</Button>
      </Typography.Text>

      {/* <div><Segmented options={["File", "URL"]}/></div> */}
      <Tabs items={tabItems} activeKey={activeTabKey} onChange={handleTabKeyChange} />

      {/*isLoading &&
        <Space size="small" align="center" >
          <Spin indicator={<LoadingOutlined />} size="small" /><Label>Loading...</Label>
        </Space>
      */}

      {!!error && <Alert message={String(error)} type="error" banner showIcon />}
    </Flex>
  )
}