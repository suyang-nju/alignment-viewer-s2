import type { TBarSpritesProps } from './types'

export default class BarSprites {
  props: TBarSpritesProps
  protected sprites: Array<OffscreenCanvas | undefined>
  
  constructor(props: TBarSpritesProps) {
    this.props = props
    this.sprites = Array(Math.ceil(this.props.height) + 1).fill(undefined)
  }

  get(barHeightRatio: number): OffscreenCanvas {
    const key = Math.round(barHeightRatio * this.props.height)
    return this.sprites[key] ?? this.makeSprite(key)
  }

  protected makeSprite(key: number): OffscreenCanvas {
    const {
      width,
      height,
      barColor,
    } = this.props
    const dpr = window.devicePixelRatio
    const canvas = new OffscreenCanvas(width * dpr, height * dpr)
    const ctx = canvas.getContext("2d")
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      ctx.fillStyle = barColor
      ctx.fillRect(0, canvas.height - key * dpr, canvas.width, key * dpr)
    }
    this.sprites[key] = canvas
    return canvas
  }
}

