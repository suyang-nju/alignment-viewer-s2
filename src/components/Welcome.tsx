import type { TAlignmentPickerProps } from '../lib/types'

import { Flex, Typography, Card } from 'antd'

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
        <AlignmentPicker
          file={file}
          isLoading={isLoading}
          error={error}
          onFileChange={onFileChange}
          onUrlChange={onUrlChange}
        />
      </Card>
    </Flex>
  )
}
