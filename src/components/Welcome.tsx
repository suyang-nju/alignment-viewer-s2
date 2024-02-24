import type { TAlignmentPickerProps } from './AlignmentPicker'
import type { ReactNode, CSSProperties } from 'react'

import {
  Flex, Typography, Card, theme as antdTheme, Button, 
} from 'antd'
import { Link, useSearchParams } from 'react-router-dom'

import AlignmentPicker from './AlignmentPicker'


export default function Welcome({
  className,
  style,
  file,
  isLoading,
  error,
  onFileChange,
  onUrlChange,
}: TAlignmentPickerProps) {
  let contentComponent: ReactNode
  const [searchParams, ] = useSearchParams()
  const url = searchParams.get("url")
  if (false && url) {
    contentComponent = (
      <Typography.Paragraph ellipsis={true}>Loading <Link to={url}>{url}</Link></Typography.Paragraph>
    )
  } else if (false && file instanceof File) {
    contentComponent = (
      <Typography.Paragraph ellipsis={true}>Loading {file.name}</Typography.Paragraph>
    )
  } else {
    contentComponent = (
      <AlignmentPicker
        file={file}
        isLoading={isLoading}
        error={error}
        onFileChange={onFileChange}
        onUrlChange={onUrlChange}
      />
    )
  }

  const antdThemeToken = antdTheme.useToken().token
  return (
    <Flex vertical align="center" className={className} style={style}>
      <Typography.Title>Alignment Viewer</Typography.Title>
      <Card
        style={{
          // padding: antdThemeToken.padding,
          width: "30%", 
          marginTop: "10%", 
          // background: antdThemeToken.colorBgBase,
        }}
      >
        {contentComponent}
      </Card>
    </Flex>
  )
}
