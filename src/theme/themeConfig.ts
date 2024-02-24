import type { ThemeConfig } from 'antd'

import { theme as antdTheme } from 'antd'

const token = {
  // fontSize: 16,
  // colorPrimary: '#52c41a',
  borderRadius: 4,
}

const components = {
  Slider: {
    trackBg: "#1677ff",
    trackHoverBg: "#1677ff",
    dotBorderColor: "#1677ff",
    dotActiveBorderColor: "#1677ff",
    handleColor: "#1677ff",
  }
}

const { defaultAlgorithm, darkAlgorithm } = antdTheme

const darkTheme = {
  algorithm: darkAlgorithm,
  token,
  components, 
  cssVar: true, // { key: "dark" },
  hashed: false,
}

const defaultTheme = {
  algorithm: defaultAlgorithm,
  token,
  components, 
  cssVar: true, // { key: "light" },
  hashed: false,
}

export { defaultTheme, darkTheme }
