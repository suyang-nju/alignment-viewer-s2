import type {
  TSequenceLogos,
  TUseSequenceLogosProps,
} from './types'

import { shouldBeStyledFactory } from './Alignment'
import { LRUMap } from "./lru"

import { useCallback, useMemo } from "react"
import { isArray } from "lodash"

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
    width, 
    height, 
    fontSize, 
    fontFamily, 
    fontWidth,
    fontActualBoundingBoxAscents, 
    fontActualBoundingBoxDescents,
    barMode = false,
    colorPalette, 
    defaultTextColor,
    referenceSequence,
    consensusSequence, 
    positionsToStyle, 
    alphabetToPssmIndex,
  } = props

  const capacity = offscreenCanvasPool.capacity()
  const logosCache = useMemo(() => (
    new LRUMap<number, OffscreenCanvas>(capacity)
  ), [capacity])

  const shouldBeStyled = shouldBeStyledFactory(
    positionsToStyle,
    referenceSequence,
    consensusSequence,
    alphabetToPssmIndex,
  )
  
  const getLogo = useCallback((sequencePosition: number, groupIndex: number = 0) => {
    const dpr = window.devicePixelRatio
    const { pssm } = groups[groupIndex]
    const key = groupIndex * pssm.length + sequencePosition
    let logo = logosCache.get(key)
    if (logo) {
      return logo
    }

    logo = offscreenCanvasPool.take()
    if (!logo) {
      [, logo] = logosCache.shift()
    }

    if (!logo) {
      return undefined
    }

    const ctx = logo.getContext("2d")
    if (!ctx) {
      offscreenCanvasPool.release(logo)
      return undefined
    }

    ctx.resetTransform()
    ctx.clearRect(0, 0, width * dpr, height * dpr)

    if (barMode) {
      ctx.imageSmoothingEnabled = false
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const indexingOffset = sequencePosition * pssm.alphabet.length
      let y = height
      const x = (width - fontWidth)/2
      for (let i = 0; i < pssm.alphabet.length; ++i) {
        const j = pssm.sortedIndices[indexingOffset + i]
        if (j === pssm.gapIndex) {
          continue
        }
  
        const percentage = pssm.values[indexingOffset + j]
        // percentage === -1 if truely 0%
        // percentage === 0 if < 0.5% (rounded to 0%)
        if (percentage <= 0) {
          continue
        }
  
        const char = pssm.alphabet[j]
        if (!shouldBeStyled(char, sequencePosition)) {
          continue
        }
        
        const letterHeight = height * percentage / 100
        ctx.fillStyle = colorPalette.get(char)?.color ?? defaultTextColor
        y -= letterHeight
        ctx.fillRect(x, y, fontWidth, letterHeight)
      }
    } else {
      ctx.imageSmoothingEnabled = true
      // ctx.textRendering = "optimizeSpeed"
      ctx.font = `${fontSize}px ${fontFamily}`
  
      const indexingOffset = sequencePosition * pssm.alphabet.length
      let y = height
      const x = dpr * (width - fontWidth)/2
      for (let i = 0; i < pssm.alphabet.length; ++i) {
        const j = pssm.sortedIndices[indexingOffset + i]
        if (j === pssm.gapIndex) {
          continue
        }
  
        const percentage = pssm.values[indexingOffset + j]
        // percentage === -1 if truely 0%
        // percentage === 0 if < 0.5% (rounded to 0%)
        if (percentage <= 0) {
          continue
        }
  
        const char = pssm.alphabet[j]
        if (!shouldBeStyled(char, sequencePosition)) {
          continue
        }
        
        const letterHeight = height * percentage / 100
        ctx.fillStyle = colorPalette.get(char)?.color ?? defaultTextColor
        const paddingBottom = 5 / letterHeight
        // const paddingBottom = 2 / Math.sqrt(letterHeight)
        // const k = 1/256
        // const paddingBottom = (Math.sqrt(letterHeight * letterHeight + 2 * k) - letterHeight) / k
        const scaleY = letterHeight / (fontActualBoundingBoxAscents[char] + fontActualBoundingBoxDescents[char] + paddingBottom)
        y -= scaleY * (fontActualBoundingBoxDescents[char] + paddingBottom)
        ctx.setTransform(dpr, 0, 0, dpr * scaleY, x, y * dpr)
        ctx.fillText(char, 0, 0)
        y -= scaleY * fontActualBoundingBoxAscents[char]  
      }
    }

    logosCache.set(key, logo)
    return logo
  }, [
    groups, 
    offscreenCanvasPool,
    logosCache,
    width, 
    height, 
    fontSize, 
    fontFamily, 
    fontWidth,
    fontActualBoundingBoxAscents, 
    fontActualBoundingBoxDescents,
    barMode,
    colorPalette, 
    defaultTextColor,
    shouldBeStyled, 
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


