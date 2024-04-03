import type { TNormalizedPosition, TAVMouseEventInfo } from '../lib/types'

import { useState, forwardRef, useImperativeHandle } from "react"

export default forwardRef(function CursorTracker(props, ref) {
  const [visible, setVisible] = useState<TAVMouseEventInfo["visible"] | undefined>(undefined)

  useImperativeHandle(ref, () => (info?: TAVMouseEventInfo) => {
    setVisible(info?.visible)
  }, [])

  let left = 0, top = 0, width = 0, height = 0
  if (visible) {
    ({left, top, width, height} = visible)
  }

  const xTrackerMatrix = `matrix(${width}, 0, 0, 1, ${left}, 0)`
  const yTrackerMatrix = `matrix(1, 0, 0, ${height}, 0, ${top})`

  return (
    <>
      <div
        className={`cursor-tracker-x`}
        style={{transform: xTrackerMatrix}}
      />
      <div
        className={`cursor-tracker-y`}
        style={{transform: yTrackerMatrix}}
      />
    </>
  )
})
