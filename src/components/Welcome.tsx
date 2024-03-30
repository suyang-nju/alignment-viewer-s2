import type { TAlignmentPickerProps } from '../lib/types'

import { Flex, Typography, Card } from 'antd'

import AlignmentPicker from './AlignmentPicker'


export default function Welcome({
  className,
  style,
  fileOrUrl,
  isLoading,
  error,
  onChange,
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
          fileOrUrl={fileOrUrl}
          isLoading={isLoading}
          error={error}
          onChange={onChange}
        />
      </Card>
    </Flex>
  )
}
