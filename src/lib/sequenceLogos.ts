import type { TColorEntry } from "./AlignmentColorSchema"
import type { TAlignment, TAlignmentPositionsToStyle } from "./Alignment"

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

export type TSequenceLogosGroupsProps = TSequenceLogosParams & {
  groups: TAlignment["groups"],
}

export type TSequenceLogosProps = TSequenceLogosParams & {
  pssm: ReadonlyArray<ReadonlyArray<number>>,
  pssmSortedIndices: ReadonlyArray<ReadonlyArray<number>>,
}

export class SequenceLogos {
  props: TSequenceLogosProps
  protected logos: Array<OffscreenCanvas | undefined>

  constructor(props: TSequenceLogosProps) {
    this.props = props
    this.logos = new Array(this.props.pssm.length).fill(undefined)
  }

  get(position: number) {
    if ((position < this.logos.length) && (this.logos[position] === undefined)) {
      this.makeLogo(position)
    }
    return this.logos[position]
  }

  protected makeLogo(position: number): void {
    const {
      pssm, 
      pssmSortedIndices, 
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
    } = this.props
    
    const dpr = window.devicePixelRatio
    this.logos[position] = new OffscreenCanvas(width * dpr, height * dpr)
    const ctx = this.logos[position]?.getContext("2d")
    if (!ctx) {
      return 
    }
    ctx.imageSmoothingEnabled = true
    ctx.textRendering = "optimizeSpeed"
    ctx.font = `${fontSize}px ${fontFamily}`

    ctx.fillStyle = backgroundColor
    ctx.fillRect(0, 0, width * dpr, height * dpr)
    
    const sortedIndices = pssmSortedIndices[position]
    let y = height
    const x = dpr * (width - fontWidth)/2
    for (const j of sortedIndices) {
      if (pssm[position][j] === 0) {
        continue
      }

      if (j === alphabet.length) { // gap
        continue
      }

      if (
        (((positionsToStyle === "sameAsReference") || (positionsToStyle === "sameAsConsensus")) && (alphabet[j] !== compareToSequence[position])) ||
        (((positionsToStyle === "differentFromReference") || (positionsToStyle === "differentFromConsensus")) && (alphabet[j] === compareToSequence[position]))
      ) {
        continue
      }
      
      const letterHeight = pssm[position][j] * height
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
  }
}


export class SequenceLogosGroups {
  props: TSequenceLogosGroupsProps
  protected groupLogos: Array<SequenceLogos | undefined>

  constructor(props: TSequenceLogosGroupsProps) {
    this.props = props
    this.groupLogos = new Array(this.props.groups.length).fill(undefined)
  }

  get(groupIndex: number) {
    if ((groupIndex < this.groupLogos.length) && (this.groupLogos[groupIndex] === undefined)) {
      this.createLogos(groupIndex)
    }
    return this.groupLogos[groupIndex]
  }

  protected createLogos(groupIndex: number): void {
    const { groups, ...otherProps } = this.props
    this.groupLogos[groupIndex] = new SequenceLogos({
      pssm: groups[groupIndex].pssm,
      pssmSortedIndices: groups[groupIndex].pssmSortedIndices,
      ...otherProps,
    })
  }
}
