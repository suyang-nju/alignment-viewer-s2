import { Shape, registerBBox, getBBoxMethod } from '@antv/g-canvas'
import { isNil, isArray } from 'lodash'

registerBBox("sequenceLogo", getBBoxMethod("image"))

export const ShapeBaseSupportingSequenceLogo = Object.create(Shape)

export class SequenceLogoShape extends Shape.Image {
  getShapeBase(): typeof Shape {
    return ShapeBaseSupportingSequenceLogo
  }

  createPath(context: CanvasRenderingContext2D): void {
  }

}
// Shape.OffscreenCanvas = OffscreenCanvasShape

ShapeBaseSupportingSequenceLogo.SequenceLogo = SequenceLogoShape
