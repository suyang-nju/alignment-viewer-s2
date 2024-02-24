"use client"

import type { RadioChangeEvent, MenuProps } from 'antd'
import type { PropsWithChildren, ChangeEvent, MouseEvent, KeyboardEvent, ReactNode } from 'react'
import type { SizeType } from 'antd/es/config-provider/SizeContext'

import type { TAlignmentColorMode } from '../lib/AlignmentColorSchema'
import type { TAlignmentViewerToggles } from './AlignmentViewer'
import type { TFormattedSequences, TAlignmentSortParams } from '../lib/Alignment'

import { useState, useMemo, forwardRef, useImperativeHandle, useCallback } from 'react'
import { 
  theme as antdTheme, Typography, Button, Drawer, Tabs, Input, InputNumber, Switch, 
  Slider, Segmented, Radio, Select, Flex, Space, Divider, Dropdown, Spin, Alert, 
} from 'antd'
import Icon, { LoadingOutlined, PlusOutlined, MinusOutlined, CheckOutlined, DownOutlined } from '@ant-design/icons'
import { BsMoonFill, BsSunFill, BsCircleHalf } from 'react-icons/bs'

import { alignmentColorModes, alignmentColorSchema} from '../lib/AlignmentColorSchema'
import { TAlignment } from '../lib/Alignment'
import AlignmentPicker from './AlignmentPicker'


export type TSettingsProps = {
  file?: File,
  alignment?: TAlignment,
  isLoading: boolean,
  error: unknown,
  zoom: number,
  toggles: TAlignmentViewerToggles,
  colorScheme?: string,
  colorMode?: TAlignmentColorMode,
  positionsToStyle?: keyof TFormattedSequences, 
  contextualInfoContainer?: string,
  darkMode: boolean,
  onFileChange: (newFile: File) => void,
  onUrlChange: (newUrl: string) => void,
  onZoomChange: (newZoom: number) => void,
  onTogglesChange: (item: string, active: boolean) => void,
  onColorSchemeChange: (value: string) => void,
  onColorModeChange: (value: TAlignmentColorMode) => void,
  onPositionsToStyleChange: (value: keyof TFormattedSequences) => void,
  onContextualInfoContainerChange: (event: RadioChangeEvent) => void,
  onDarkModeChange: () => void,
}

export type TInputNumberWithPlusMinusProps = {
  value: number,
  min?: number,
  max?: number,
  size: SizeType,
  controls?: boolean,
  onChange: (value: number) => void,
}

function InputNumberWithPlusMinus<T>({
  value, 
  min: minValue = Number.MIN_SAFE_INTEGER,
  max: maxValue = Number.MAX_SAFE_INTEGER,
  size, 
  controls, 
  onChange, 
  ...restProps
}: T & TInputNumberWithPlusMinusProps) {
  function handleInputChange(newValue: number | null) {
    if ((newValue || (newValue === 0)) && (newValue !== value)) {
      onChange(newValue)
    }
  }

  function handleMinusButtonClick() {
    const newValue = value - 1
    if ((newValue >= minValue) && (newValue <= maxValue)) {
      onChange(newValue)
    }
  }

  function handlePlusButtonClick() {
    const newValue = value + 1
    if ((newValue >= minValue) && (newValue <= maxValue)) {
      onChange(newValue)
    }
  }

  return (
    <Space.Compact className="input-number-with-plus-minus" size={size}>
      <Button icon={<MinusOutlined/>} disabled={value === minValue} onClick={handleMinusButtonClick} />
      <InputNumber {...restProps} min={minValue} max={maxValue} controls={false} value={value} onChange={handleInputChange} />
      <Button icon={<PlusOutlined/>} disabled={value === maxValue} onClick={handlePlusButtonClick} />
    </Space.Compact>
  )
}

function Label({children}: {children: ReactNode}) {
  return <Typography.Text style={{wordBreak: "keep-all"}}>{children}</Typography.Text>
}

function SettingsItem(props: PropsWithChildren) {
  const {children, ...restProps} = props
  return (
    <Flex {...restProps} gap={8} justify="space-between" align="center" style={{minWidth: "42.5%"}} >
      {children}
    </Flex>
  )
}

export default forwardRef(function Settings({
  file,
  alignment,
  isLoading,
  error,
  zoom,
  toggles,
  colorScheme = Object.keys(alignmentColorSchema)[0],
  colorMode = alignmentColorModes[0],
  positionsToStyle = "all",
  contextualInfoContainer = "status bar",
  darkMode = false,
  onFileChange,
  onUrlChange,
  onZoomChange,
  onTogglesChange,
  onColorSchemeChange,
  onColorModeChange,
  onPositionsToStyleChange,
  onContextualInfoContainerChange,
  onDarkModeChange,
}: TSettingsProps, ref) {
  const [isVisible, setIsVisible] = useState<boolean>(false)

  useImperativeHandle(ref, () => ({
    open: () => { setIsVisible(true) },
    close: () => { setIsVisible(false) },
  }), [])

  const handleClose = () => {
    setIsVisible(false)
  }

  const referenceSequenceIdOptions = useMemo(() => (
    alignment?.sequences.map((rec, idx) => ({ value: idx, label: rec.id })) ?? []
  ), [alignment?.sequences])

  const antdThemeToken = antdTheme.useToken().token
  // console.log(antdThemeToken.Tabs?.horizontalItemPadding)
  if (error) {
    console.log(error)
  }

  return (
    <Drawer 
      title="Alignment Viewer" 
      placement="left" 
      onClose={handleClose} 
      open={isVisible}
      mask={false}
      extra={<Button icon={<Icon component={darkMode ? BsCircleHalf : BsCircleHalf}/>} onClick={onDarkModeChange}>{darkMode ? "Light" : "Dark"}</Button>}
    >
      <Flex vertical gap="middle" justify="flex-start" >
        <AlignmentPicker
          file={file}
          isLoading={isLoading}
          error={error}
          style={{marginTop: -12}}
          onFileChange={onFileChange}
          onUrlChange={onUrlChange}
        />
        <Divider orientation="left" orientationMargin={0} style={{marginBottom: 0}} >Settings</Divider>
        {/* <Space size="small" >
          <Label>Reference</Label>
          <Select
            id="reference"
            value={alignment?.referenceSequenceIndex}
            options={referenceSequenceIdOptions}
            popupMatchSelectWidth={false}
            // size="small"
          />
        </Space> */}
        <Space>
          <Label>Show</Label>
          <Select
            id="position-to-style"
            value={positionsToStyle}
            // options={alignmentPositionsToStyle.map(k => ({label: k, value: k}))}
            options={[
              { label: "All Residues",               value: "all" }, 
              { label: "Same as Reference",          value: "sameAsReference" }, 
              { label: "Differences from Reference", value: "differentFromReference" }, 
              { label: "Same as Consensus",          value: "sameAsConsensus" }, 
              { label: "Differeces from Consensus",  value: "differentFromConsensus" }, 
            ]}
            popupMatchSelectWidth={false}
            // size="small"
            onChange={onPositionsToStyleChange}
          />
        </Space>
        <Flex wrap="wrap" gap="middle" justify="space-between" >
          {Object.entries(toggles).map(
            ([item, {label, visible}]) => (
              <SettingsItem key={item} >
                <Label>{label}</Label>
                <Switch 
                  checked={visible} 
                  size="small" 
                  onChange={(checked: boolean) => onTogglesChange(item, checked)} 
                />
              </SettingsItem>
            )
          )}
          <SettingsItem>
            <Label>Size</Label>
            <Slider
              defaultValue={zoom} 
              min={1}
              max={16}
              marks={{5: {style: {display: "none"}, label: "5"}}}
              style={{width: "100%", margin: "0px 6px"}}
              onChange={onZoomChange}
            />
            {/* 
            <InputNumberWithPlusMinus 
              value={zoom} 
              min={1}
              id="zoom" 
              size="small" 
              style={{width: "3em"}} 
              onChange={onZoomChange}
            /> 
            */}
          </SettingsItem>
        </Flex>
        <Space size="small" >
          <Label>Color</Label>
          <Select
            id="color-scheme"
            value={colorScheme}
            options={Object.keys(alignmentColorSchema).map(k => ({label: k, value: k}))}
            popupMatchSelectWidth={false}
            // size="small"
            onChange={onColorSchemeChange}
          />
          <Select 
            id="color-style"
            value={colorMode} 
            options={alignmentColorModes.map(k => ({label: k, value: k}))} 
            // optionType="button" 
            popupMatchSelectWidth={false}
            // size="small"
            onChange={onColorModeChange}
          />
        </Space>
        <Space size="small" >
          <Label>Show contextual info in</Label>
          <Radio.Group 
            value={contextualInfoContainer}
            options={["status bar", "tooltip"]}
            optionType="button"
            buttonStyle="solid"
            size="small"
            name="contextual-info"
            onChange={onContextualInfoContainerChange}
          />
          {/* <Segmented
            options={["status bar", "tooltip"]}
          /> */}
        </Space>
      </Flex>
    </Drawer>
  )
})
