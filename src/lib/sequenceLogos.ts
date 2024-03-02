import type { TColorEntry } from "./AlignmentColorSchema"
import type { TPssm, TSequenceGroup, TAlignmentPositionsToStyle } from "./Alignment"
import type { ObjectPool } from "./objectPool"

import { LRUMap } from "./lru"

import { useCallback, useMemo } from "react"
import { isArray } from "lodash"

type TSequenceLogosParams = {
  alphabet: string,
  width: number,
  height: number,
  fontSize: number,
  fontFamily: string,
  fontWidth: number,
  fontActualBoundingBoxAscents: number[],
  fontActualBoundingBoxDescents: number[],
  colorPalette: Map<string, TColorEntry>,
  defaultTextColor: string, 
  backgroundColor: string,
  compareToSequence: string,
  positionsToStyle: TAlignmentPositionsToStyle,
}

type TUseSequenceLogosProps = TSequenceLogosParams & {
  pssmOrGroups?: TPssm | TSequenceGroup[],
  offscreenCanvasPool: ObjectPool<OffscreenCanvas>,
}

export type TSequenceLogos = undefined | {
  props: TUseSequenceLogosProps,
  get: (sequencePosition: number, groupIndex?: number) => OffscreenCanvas | undefined,
}

export function useSequenceLogos(props: TUseSequenceLogosProps): TSequenceLogos {
  const groups = useMemo(() => {
    if (!props.pssmOrGroups) {
      return []
    }

    if (isArray(props.pssmOrGroups)) {
      return props.pssmOrGroups
    } else {
      return [{
        members: [],
        pssm: props.pssmOrGroups,
      }]
    }
  }, [props.pssmOrGroups])

  const {
    offscreenCanvasPool,
    alphabet,
    width, 
    height, 
    fontSize, 
    fontFamily, 
    fontWidth,
    fontActualBoundingBoxAscents, 
    fontActualBoundingBoxDescents,
    colorPalette, 
    defaultTextColor,
    backgroundColor,
    compareToSequence, 
    positionsToStyle, 
  } = props

  const capacity = offscreenCanvasPool.capacity()
  const logosCache = useMemo(() => (
    new LRUMap<number, OffscreenCanvas>(capacity)
  ), [capacity])
  
  const getLogo = useCallback((sequencePosition: number, groupIndex: number = 0) => {
    const dpr = window.devicePixelRatio
    const { pssm } = groups[groupIndex]
    const key = groupIndex * pssm.length + sequencePosition
    let logo = logosCache.get(key)
    if (logo) {
      return logo
    }

    if (logosCache.size === capacity) {
      [, logo] = logosCache.shift()
    } else {
      logo = offscreenCanvasPool.take()
    }

    if (!logo) {
      return undefined
    }

    const ctx = logo.getContext("2d")
    if (!ctx) {
      offscreenCanvasPool.release(logo)
      return undefined
    }
    ctx.imageSmoothingEnabled = true
    // ctx.textRendering = "optimizeSpeed"
    ctx.font = `${fontSize}px ${fontFamily}`

    ctx.fillStyle = backgroundColor
    ctx.resetTransform()
    ctx.fillRect(0, 0, width * dpr, height * dpr)
    
    const indexingOffset = sequencePosition * pssm.numSymbols
    let y = height
    const x = dpr * (width - fontWidth)/2
    for (let i = 0; i < pssm.numSymbols; ++i) {
      const j = pssm.sortedIndices[indexingOffset + i]
      if (j === pssm.numSymbols - 1) { // gap
        continue
      }

      const percentage = pssm.values[indexingOffset + j]
      if (percentage <= 0) {
        continue
      }

      if (
        (((positionsToStyle === "sameAsReference") || (positionsToStyle === "sameAsConsensus")) && (alphabet[j] !== compareToSequence[sequencePosition])) ||
        (((positionsToStyle === "differentFromReference") || (positionsToStyle === "differentFromConsensus")) && (alphabet[j] === compareToSequence[sequencePosition]))
      ) {
        continue
      }
      
      const letterHeight = height * percentage / 100
      ctx.fillStyle = colorPalette.get(alphabet[j])?.color ?? defaultTextColor
      const paddingBottom = 5 / letterHeight
      // const paddingBottom = 2 / Math.sqrt(letterHeight)
      // const k = 1/256
      // const paddingBottom = (Math.sqrt(letterHeight * letterHeight + 2 * k) - letterHeight) / k
      const scaleY = letterHeight / (fontActualBoundingBoxAscents[j] + fontActualBoundingBoxDescents[j] + paddingBottom)
      y -= scaleY * (fontActualBoundingBoxDescents[j] + paddingBottom)
      ctx.setTransform(dpr, 0, 0, dpr * scaleY, x, y * dpr)
      ctx.fillText(alphabet[j], 0, 0)
      y -= scaleY * fontActualBoundingBoxAscents[j]  
    }

    logosCache.set(key, logo)
    return logo
  }, [
    groups, 
    offscreenCanvasPool,
    capacity,
    logosCache,
    width, 
    height, 
    alphabet,
    fontSize, 
    fontFamily, 
    fontWidth,
    fontActualBoundingBoxAscents, 
    fontActualBoundingBoxDescents,
    colorPalette, 
    defaultTextColor,
    backgroundColor,
    compareToSequence, 
    positionsToStyle, 
  ])

  useMemo(() => {
    getLogo
    for (const v of logosCache.values()) {
      if (v) {
        offscreenCanvasPool.release(v)
      }
    }
    logosCache.clear()
  }, [getLogo, logosCache, offscreenCanvasPool])

  return { props, get: getLogo }
}


