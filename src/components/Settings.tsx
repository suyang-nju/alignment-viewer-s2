"use client"

import type { PropsWithChildren, ReactNode } from 'react'

import type {
  TSettingsProps,
} from '../lib/types'

import { useState, useMemo, forwardRef, useImperativeHandle, useCallback } from 'react'
import { 
  theme as antdTheme, Typography, Button, Drawer, Tabs, Input, InputNumber, Switch, 
  Slider, Segmented, Radio, Select, Flex, Space, Divider, Dropdown, Spin, Alert, 
} from 'antd'
import Icon, { LoadingOutlined, PlusOutlined, MinusOutlined, CheckOutlined, DownOutlined } from '@ant-design/icons'
import { BsMoonFill, BsSunFill, BsCircleHalf } from 'react-icons/bs'

import {
  ALIGNMENT_COLOR_MODES
} from '../lib/constants'
import { alignmentColorSchema } from '../lib/AlignmentColorSchema'
import AlignmentPicker from './AlignmentPicker'

function Label({children}: {children: ReactNode}) {
  return <Typography.Text style={{wordBreak: "keep-all"}}>{children}</Typography.Text>
}

function SettingsItem(props: PropsWithChildren) {
  const {children, ...restProps} = props
  return (
    <Flex {...restProps} gap={8} justify="space-between" align="center" >
      {children}
    </Flex>
  )
}

export default forwardRef(function Settings({
  file,
  isLoading,
  error,
  zoom,
  toggles,
  colorScheme = Object.keys(alignmentColorSchema)[0],
  colorMode = ALIGNMENT_COLOR_MODES[0],
  positionsToStyle = "all",
  hideUnstyledPositions = false,
  contextualInfoContainer = "status bar",
  darkMode = false,
  onFileChange,
  onUrlChange,
  onZoomChange,
  onTogglesChange,
  onColorSchemeChange,
  onColorModeChange,
  onPositionsToStyleChange,
  onHideUnstyledPositionsChange,
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

  // const antdThemeToken = antdTheme.useToken().token
  // console.log(antdThemeToken.Tabs?.horizontalItemPadding)
  if (error) {
    console.log(error)
  }

  return (
    <Drawer 
      title="Alignment Viewer" 
      placement="left" 
      width="fit-content"
      onClose={handleClose} 
      open={isVisible}
      mask={true}
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
        <div className="settings-toggles-grid" >
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
        </div>
        <div/>
        <Space /*style={{justifyContent: "space-between"}}*/ >
          <Space size="small" >
            <Label>Theme</Label>
            <Select
              id="color-scheme"
              value={colorScheme}
              options={Object.keys(alignmentColorSchema).map(k => ({label: k, value: k}))}
              popupMatchSelectWidth={false}
              // size="small"
              onChange={onColorSchemeChange}
            />
          </Space>
          <Space size="small">
            <Label>Text Only</Label>
            <Switch
              checked={colorMode === "Letter Only"} 
              size="small" 
              onChange={(checked: boolean) => onColorModeChange(checked ? "Letter Only" : "With Background")} 
            />
          </Space>
        </Space>
        <Space>
          <Label>For</Label>
          <Select
            id="position-to-style"
            value={positionsToStyle}
            // options={alignmentPositionsToStyle.map(k => ({label: k, value: k}))}
            options={[
              { label: "All Residues",               value: "all" }, 
              { label: "Residues Same as Reference",          value: "sameAsReference" }, 
              { label: "Residues Different from Reference", value: "differentFromReference" }, 
              { label: "Residues Same as Consensus",          value: "sameAsConsensus" }, 
              { label: "Residues Differet from Consensus",  value: "differentFromConsensus" }, 
            ]}
            popupMatchSelectWidth={false}
            // size="small"
            onChange={onPositionsToStyleChange}
          />
        </Space>
        {(positionsToStyle !== "all") && (
          <Space size="small" >
            <Label>Hide other residues</Label>
            <Switch
              checked={hideUnstyledPositions} 
              size="small" 
              onChange={onHideUnstyledPositionsChange} 
            />
          </Space>
        )}
        <div/>
        <Space size="small" >
          <Label>Additional information in</Label>
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
