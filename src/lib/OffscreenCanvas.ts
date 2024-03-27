import { Shape, registerBBox, getBBoxMethod } from '@antv/g-canvas'
import { isNil, isArray } from 'lodash'

registerBBox("offscreenCanvas", getBBoxMethod("image"))

export const ShapeBaseSupportingOffscreenCanvas = Object.create(Shape)

export class OffscreenCanvasShape extends Shape.Image {
  getShapeBase(): typeof Shape {
    return ShapeBaseSupportingOffscreenCanvas
  }

  createPath(context: CanvasRenderingContext2D): void {
    const { src, img } = this.attr()
    const image = img ?? src
    if (!image || (isArray(image) && (image.length === 0))) {
      return
    }

    const {
      x, y, width, height, 
      dx, dy, dWidth, dHeight, 
      sx, sy, sWidth, sHeight, 
      skipX, 
      imageSmoothingEnabled, 
    } = this.attr()

    const oldImageSmoothingEnabled = context.imageSmoothingEnabled
    const newImageSmoothingEnabled = imageSmoothingEnabled ?? true
    if (context.imageSmoothingEnabled !== newImageSmoothingEnabled) {
      context.imageSmoothingEnabled = newImageSmoothingEnabled
    }

    if (!isNil(sx) && !isNil(sy) && !isNil(sWidth) && !isNil(sHeight) && !isNil(dx) && !isNil(dy) && !isNil(dWidth) && !isNil(dHeight)) {
      if (isArray(image)) {
        let ix = dx
        for (const i of image) {
          if (i) {
            context.drawImage(i, sx, sy, sWidth, sHeight, ix, dy, dWidth, dHeight)
          }
          ix += skipX
        }
      } else {
        context.drawImage(image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight)
      }
    } else if (!isNil(dx) && !isNil(dy) && !isNil(dWidth) && !isNil(dHeight)) {
      if (isArray(image)) {
        let ix = dx
        for (const i of image) {
          if (i) {
            context.drawImage(i, ix, dy, dWidth, dHeight)
          }
          ix += skipX
        }
      } else {
        context.drawImage(image, dx, dy, dWidth, dHeight)
      }
    } else if (!isNil(x) && !isNil(y) && !isNil(width) && !isNil(height)) {
      if (isArray(image)) {
        let ix = x
        for (const i of image) {
          if (i) {
            context.drawImage(i, ix, y, width, height)
          }
          ix += skipX
        }
      } else {
        context.drawImage(image, x, y, width, height)
      }
    }
    
    // if (!isNil(sx) && !isNil(sy) && !isNil(swidth) && !isNil(sheight)) {
    //   context.drawImage(img, sx, sy, swidth, sheight, x, y, width, height)
    // } else {
    //   context.drawImage(img, x, y, width, height)
    // }

    if (context.imageSmoothingEnabled !== oldImageSmoothingEnabled) {
      context.imageSmoothingEnabled = oldImageSmoothingEnabled
    }
  }

}
// Shape.OffscreenCanvas = OffscreenCanvasShape

ShapeBaseSupportingOffscreenCanvas.OffscreenCanvas = OffscreenCanvasShape
