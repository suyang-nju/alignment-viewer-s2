export type TBarSpritesProps = {
  width: number,
  height: number,
  barColor: string,
  backgroundColor: string,
}

export default class BarSprites {
  props: TBarSpritesProps
  protected sprites: Array<OffscreenCanvas | undefined>
  
  constructor(props: TBarSpritesProps) {
    this.props = props
    this.sprites = Array(this.props.height + 1).fill(undefined)
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
      backgroundColor,
    } = this.props
    const dpr = window.devicePixelRatio
    const canvas = new OffscreenCanvas(width * dpr, height * dpr)
    const ctx = canvas.getContext("2d")
    if (ctx) {
      ctx.fillStyle = barColor
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      ctx.fillStyle = backgroundColor
      ctx.fillRect(0, 0, canvas.width, canvas.height - key * dpr)
    }
    this.sprites[key] = canvas
    return canvas
  }
}

