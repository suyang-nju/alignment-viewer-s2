import Papa from 'papaparse'
import { expose } from 'threads/worker'

const PREVIEW_LINE_COUNT = 10

let fileContent = ""

expose({
  async getPreviewContent(fileOrUrl: File | string) {
    if (typeof fileOrUrl === "string") {
      const response = await fetch(fileOrUrl)
      fileContent = await response.text()
    } else {
      fileContent = await fileOrUrl.text()
    }

    let pos = 0
    let lineCount = 0
    for (let i = 0; i < fileContent.length; ++i) {
      if ((fileContent[i] === "\n") || (fileContent[i] === "\r")) {
        if (i - pos > 1) {
          // non-empty line
          ++lineCount
        }

        pos = i

        if (lineCount === PREVIEW_LINE_COUNT) {
          break
        }
      }
    }

    return (lineCount === PREVIEW_LINE_COUNT) ? fileContent.substring(0, pos) : fileContent
  },

  parse(delimiter: string) {
    const result = Papa.parse(fileContent, {header: true, delimiter})
    return result.data
  }
})
