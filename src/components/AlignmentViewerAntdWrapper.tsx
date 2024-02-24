import type { TAlignmentViewerProps, TAVColorTheme } from './AlignmentViewer'

import { theme as antdTheme } from 'antd'
import { useMemo } from 'react'

import AlignmentViewer from './AlignmentViewer'

export default function AlignmentViewerAntdWrapper(props: Omit<TAlignmentViewerProps, "colorTheme"> & {darkMode: boolean}) {
  const { darkMode, ...otherProps } = props
  const antdThemeToken = antdTheme.useToken().token
  const colorTheme: TAVColorTheme = useMemo(() => (
    darkMode ? {
      headerText: antdThemeToken.colorText, // '#BAC1CC', 
      backgroundAlt: '#151617', 
      backgroundOnHover: '#3F4349', 
      headerBackground: '#1F2124', 
      headerBackgroundOnHover: '#3F4349', 
      selectionMask: '#3F4349', 
      link: antdThemeToken.colorLink, // '#1668dc', 
      resizeIndicator: '#BAC1CC', 
      background: antdThemeToken.colorBgLayout, 
      border: '#1F2124', 
      headerBorder: '#3F4349', 
      verticalSplitLine: '#858E9B', 
      horizontalSplitLine: '#858E9B', 
      text: antdThemeToken.colorText, //'#BAC1CC', 
      borderOnHover: '#6E757F', 
    } : {
      headerText: antdThemeToken.colorText, // '#000000', 
      backgroundAlt: '#FAFBFB', 
      backgroundOnHover: '#F0F2F4', 
      headerBackground: '#F0F2F4', 
      headerBackgroundOnHover: '#E7E9ED', 
      selectionMask: '#6E757F', 
      link: antdThemeToken.colorLink, // '#1677ff', 
      resizeIndicator: '#9DA7B6', 
      background: antdThemeToken.colorBgLayout, 
      border: '#F0F2F4', 
      headerBorder: '#E7E9ED', 
      verticalSplitLine: '#BAC1CC', 
      horizontalSplitLine: '#BAC1CC', 
      text: antdThemeToken.colorText, //'#000000', 
      borderOnHover: '#858E9B', 
    }
  ), [darkMode, antdThemeToken.colorBgLayout, antdThemeToken.colorLink, antdThemeToken.colorText])
  return <AlignmentViewer {...otherProps} colorTheme={colorTheme} />
}
