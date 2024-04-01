import type { TSpriteProps } from './types'

import { isString } from "lodash"

export default class Sprites {
  props: TSpriteProps
  protected coloredSprites: Record<string, OffscreenCanvas> = {}
  protected mutedSprites: Record<string, OffscreenCanvas> = {}
  
  constructor(props: TSpriteProps) {
    this.props = props
  }

  get(key: string): OffscreenCanvas {
    return this.coloredSprites[key] ?? this.makeSprite(key)
  }

  getMuted(key: string): OffscreenCanvas {
    return this.mutedSprites[key] ?? this.makeSprite(key, true)
  }

  protected makeSprite(key: string, muted: boolean = false): OffscreenCanvas {
    const {
      alphabet,
      dpr,
      width, 
      height, 
      font, 
      fontActualBoundingBoxAscents,
      fontActualBoundingBoxDescents,
      textColor, 
      defaultTextColor, 
      mutedTextColor,
      backgroundColor, 
      rotation,
      isOverviewMode, 
    } = this.props
    const spriteWidth = width
    const spriteHeight = isOverviewMode ? width : height
    const canvas = new OffscreenCanvas(spriteWidth * dpr, spriteHeight * dpr)
    const ctx = canvas.getContext("2d")
    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      
      let bg: string | undefined = undefined
      if (!muted) {
        if (isString(backgroundColor)) {
          bg = backgroundColor
        } else if (backgroundColor instanceof Map) {
          bg = backgroundColor.get(key)?.color
        }  
      }
      
      if (bg) {
        ctx.fillStyle = bg
        // ctx.globalAlpha = 0.5
        ctx.fillRect(0, 0, spriteWidth, spriteHeight)
        // ctx.globalAlpha = 1.0
      }

      if (!isOverviewMode) {
        ctx.textAlign = "center"
        
        if (rotation) {
          ctx.rotate(rotation)
        }
        
        if (font) {
          ctx.font = font
        }
        
        let fg: string | undefined
        if (muted) {
          fg = mutedTextColor
        } else if (isString(textColor)) {
          fg = textColor
        } else if (textColor instanceof Map) {
          fg = textColor.get(key)?.color ?? defaultTextColor
        } else {
          fg = defaultTextColor
        }
        
        if (fg) {
          ctx.fillStyle = fg
        }
  
        ctx.textBaseline = "middle"
        ctx.fillText(key, spriteWidth / 2, spriteHeight / 2)
        // if (key in fontActualBoundingBoxAscents) {
        //   ctx.textBaseline = "alphabetic"
        //   const ascent = fontActualBoundingBoxAscents[key]
        //   const descent = fontActualBoundingBoxDescents[key]
        //   ctx.fillText(key, spriteWidth / 2, (spriteHeight + ascent - descent) / 2)
        // } else {
        //   ctx.textBaseline = "middle"
        //   ctx.fillText(key, spriteWidth / 2, spriteHeight / 2)
        // }
      }
    }

    if (muted) {
      this.mutedSprites[key] = canvas
    } else {
      this.coloredSprites[key] = canvas
    }

    return canvas
  }

}

