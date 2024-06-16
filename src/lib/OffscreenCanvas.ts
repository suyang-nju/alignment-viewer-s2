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
    let image = img ?? src
    if (isArray(image)) {
      if (image.length > 0) {
        image = image[0]
      } else {
        return
      }
    }

    if (image instanceof OffscreenCanvas) {
      this.createPathForOffscreenCanvas(context)
    } else if (image instanceof ImageData) {
      this.createPathForImageData(context)
    }
  }

  createPathForOffscreenCanvas(context: CanvasRenderingContext2D): void {
    const {
      src, img, 
      x, y, width, height, 
      dx, dy, dWidth, dHeight, 
      sx, sy, sWidth, sHeight, 
      skipX, 
      imageSmoothingEnabled, 
    } = this.attr()

    const image = (img ?? src) as OffscreenCanvas | OffscreenCanvas[]
    if (!image) {
      return
    }

    const oldImageSmoothingEnabled = context.imageSmoothingEnabled
    const newImageSmoothingEnabled = imageSmoothingEnabled ?? true
    if (context.imageSmoothingEnabled !== newImageSmoothingEnabled) {
      context.imageSmoothingEnabled = newImageSmoothingEnabled
    }

    if (!isNil(sx) && !isNil(sy) && !isNil(sWidth) && !isNil(sHeight) && !isNil(dx) && !isNil(dy) && !isNil(dWidth) && !isNil(dHeight)) {
      if (image instanceof OffscreenCanvas) {
        context.drawImage(image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight)
      } else {
        let ix = dx
        for (const i of image) {
          if (i) {
            context.drawImage(i, sx, sy, sWidth, sHeight, ix, dy, dWidth, dHeight)
          }
          ix += skipX
        }
      }
    } else if (!isNil(dx) && !isNil(dy) && !isNil(dWidth) && !isNil(dHeight)) {
      if (image instanceof OffscreenCanvas) {
        context.drawImage(image, dx, dy, dWidth, dHeight)  
      } else {
        let ix = dx
        for (const i of image) {
          if (i) {
            context.drawImage(i, ix, dy, dWidth, dHeight)
          }
          ix += skipX
        }
      }
    } else if (!isNil(x) && !isNil(y) && !isNil(width) && !isNil(height)) {
      if (image instanceof OffscreenCanvas) {
        context.drawImage(image, x, y, width, height)
      } else {
        let ix = x
        for (const i of image) {
          if (i) {
            context.drawImage(i, ix, y, width, height)
          }
          ix += skipX
        }
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

  createPathForImageData(context: CanvasRenderingContext2D): void {
    const { src, img, sx, sy, sWidth, sHeight } = this.attr()
    let { dx, dy, skipX } = this.attr()

    const image = (img ?? src) as ImageData | ImageData[]
    if (!image) {
      return
    }

    const { a, b, c, d, e, f } = context.getTransform()
    ;[dx, dy] = [a * dx + c * dy + e, b * dx + d * dy + f]

    if (!isNil(sx) && !isNil(sy) && !isNil(sWidth) && !isNil(sHeight) && !isNil(dx) && !isNil(dy)) {  
      if (image instanceof ImageData) {
        context.putImageData(image, dx, dy, sx, sy, sWidth, sHeight)
      } else {
        skipX *= a
        let ix = dx
        for (const i of image) {
          if (i) {
            context.putImageData(i, ix, dy, sx, sy, sWidth, sHeight)
          }
          ix += skipX
        }
      }
    } else if (!isNil(dx) && !isNil(dy)) {
      if (image instanceof ImageData) {
        context.putImageData(image, dx, dy)  
      } else {
        skipX *= a
        let ix = dx
        for (const i of image) {
          if (i) {
            context.putImageData(i, ix, dy)
          }
          ix += skipX
        }
      }
    }
  }

}
// Shape.OffscreenCanvas = OffscreenCanvasShape

ShapeBaseSupportingOffscreenCanvas.OffscreenCanvas = OffscreenCanvasShape
