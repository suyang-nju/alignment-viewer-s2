import type { TColorEntry } from '../lib/AlignmentColorSchema'

import { isString } from "lodash"

export type TSpriteProps = {
  alphabet: string,
  width: number,
  height: number,
  font: string,
  fontActualBoundingBoxAscents: number[],
  fontActualBoundingBoxDescents: number[],
  textColor: string | Map<string, TColorEntry>,
  defaultTextColor: string,
  backgroundColor: string | Map<string, TColorEntry>,
  defaultBackgroundColor: string
  rotation?: number,
  isOverviewMode: boolean,
}

export default class Sprites {
  props: TSpriteProps
  protected sprites: Array<OffscreenCanvas | undefined> = Array(256).fill(undefined)
  
  constructor(props: TSpriteProps) {
    this.props = props
  }

  get(key: string): OffscreenCanvas {
    return this.sprites[key.charCodeAt(0)] ?? this.makeSprite(key)
  }

  protected makeSprite(key: string): OffscreenCanvas {
    const {
      alphabet,
      width, 
      height, 
      font, 
      fontActualBoundingBoxAscents,
      fontActualBoundingBoxDescents,
      textColor, 
      defaultTextColor, 
      backgroundColor, 
      defaultBackgroundColor, 
      rotation,
      isOverviewMode, 
    } = this.props
    const spriteWidth = width
    const spriteHeight = isOverviewMode ? width : height
    const dpr = window.devicePixelRatio
    const canvas = new OffscreenCanvas(spriteWidth * dpr, spriteHeight * dpr)
    const ctx = canvas.getContext("2d")
    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      
      let bg: string | undefined
      if (isString(backgroundColor)) {
        bg = backgroundColor
      } else if (backgroundColor instanceof Map) {
        bg = backgroundColor.get(key)?.color ?? defaultBackgroundColor
      }
      
      if (bg) {
        ctx.fillStyle = bg
        ctx.fillRect(0, 0, spriteWidth, spriteHeight)
      }

      if (!isOverviewMode) {
        ctx.textAlign = "center"
        
        if (rotation) {
          ctx.rotate(rotation)
        }
        
        if (!!font) {
          ctx.font = font
        }
        
        let fg: string | undefined
        if (isString(textColor)) {
          fg = textColor
        } else if (textColor instanceof Map) {
          fg = textColor.get(key)?.color ?? defaultTextColor
        }
        
        if (fg) {
          ctx.fillStyle = fg
        }
  
        const i = alphabet.indexOf(key)
        if (i === -1) {
          ctx.textBaseline = "middle"
          ctx.fillText(key, spriteWidth / 2, spriteHeight / 2)
        } else {
          // ctx.textBaseline = "alphabetic"
          const ascent = fontActualBoundingBoxAscents[i]
          const descent = fontActualBoundingBoxDescents[i]
          ctx.fillText(key, spriteWidth / 2, (spriteHeight + ascent - descent) / 2)
        }
      }
    }

    this.sprites[key.charCodeAt(0)] = canvas
    return canvas
  }

}

