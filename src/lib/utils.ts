export const getObjectKeys = Object.keys as <T extends object>(obj: T) => Array<keyof T>

export function scaleToFit(width: number, height: number, maxWidth: number, maxHeight: number) {
  let scaledWidth: number, scaledHeight: number
  if (height * maxWidth <= width * maxHeight) {
    scaledWidth = maxWidth
    scaledHeight = Math.floor(maxWidth * height / width)
  } else {
    scaledWidth = Math.floor(maxHeight * width / height)
    scaledHeight = maxHeight
  }

  if (scaledWidth < 1) {
    scaledWidth = 1
  }

  if (scaledHeight < 1) {
    scaledHeight = 1
  }
  
  return [scaledWidth, scaledHeight]
}
  
export function assert(condition: boolean) {
  if (!condition) {
    throw Error("assertion failed")
  }
}

export function formatFieldName(fieldName: string): string {
  let formattedFieldName: string = fieldName.replace(/_/g, " ").trim()
  formattedFieldName = formattedFieldName.charAt(0).toUpperCase() + formattedFieldName.slice(1)
  formattedFieldName = formattedFieldName.replace(/([a-z])([A-Z])/g, '$1 $2');
  formattedFieldName = formattedFieldName.replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
  return formattedFieldName
}

export class DefaultMap<K, V> extends Map<K, V> {
  defaultFactory: () => V

  constructor(defaultFactory: () => V) {
    super()
    this.defaultFactory = defaultFactory
  }

  get(key: K): V {
    if (!this.has(key)) {
      this.set(key, this.defaultFactory())
    }
    return super.get(key) as V
  }
}
