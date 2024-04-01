import type { TContextualInfo, TAVMouseEventInfo } from '../lib/types'

import { useState, forwardRef, useImperativeHandle } from "react"

export default forwardRef(function CursorTracker(props, ref) {
  const [contextualInfo, setContextualInfo] = useState<TContextualInfo | undefined>(undefined)

  useImperativeHandle(ref, () => (info?: TAVMouseEventInfo) => {
    setContextualInfo(info?.contextualInfo)
  }, [])

  const xTrackerMatrix = `matrix(${contextualInfo?.anchorWidth}, 0, 0, 1, ${contextualInfo?.anchorX}, 0)`
  const yTrackerMatrix = `matrix(1, 0, 0, ${contextualInfo?.anchorHeight}, 0, ${contextualInfo?.anchorY})`

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
