import { lighten, parseToRgba } from "color2k"

type TAlignmentColorMode = (typeof alignmentColorModes)[number]

const alignmentColorModes = ["Light", "Dark", "Letter Only"] as const

export type TColorEntry = {
  color: string, 
  rgba: number[],
}

export type TAlignmentColorPalette = Record<"Dark" | "Light", Map<string, TColorEntry>>

const alignmentColorSchema: Record<string, TAlignmentColorPalette> = {}

function addScheme(name: string, palette: {[key: string]: string}) {
  // alignmentColorSchema[name] = Object.fromEntries(alignmentColorModes.map(
  //   (key) => ([key, new Map<string, string>])
  // ))
  alignmentColorSchema[name] = {
    Dark: new Map<string, TColorEntry>(), 
    Light: new Map<string, TColorEntry>(),
  }

  for (const [key, color] of Object.entries(palette)) {
    const rgba = parseToRgba(color)
    rgba[3] = 255
    alignmentColorSchema[name]["Dark"].set(key.toUpperCase(), { color, rgba })
    alignmentColorSchema[name]["Dark"].set(key.toLowerCase(), { color, rgba })

    const lightColor = lighten(color, 0.35)
    const lightRgba = parseToRgba(lightColor)
    lightRgba[3] = 255
    alignmentColorSchema[name]["Light"].set(key.toUpperCase(), { color: lightColor, rgba: lightRgba })
    alignmentColorSchema[name]["Light"].set(key.toLowerCase(), { color: lightColor, rgba: lightRgba })
  }
}


addScheme("Default Amino Acid", {
  A: "#33cc00",
  R: "#cc0000",
  N: "#6600cc",
  D: "#0033ff",
  C: "#ffff00",
  Q: "#6600cc",
  E: "#0033ff",
  G: "#33cc00",
  H: "#009900",
  I: "#33cc00",
  L: "#33cc00",
  K: "#cc0000",
  M: "#33cc00",
  F: "#009900",
  P: "#33cc00",
  S: "#0099ff",
  T: "#0099ff",
  W: "#009900",
  Y: "#009900",
  V: "#33cc00",
})

addScheme("Buried Index", {
  A: "#00a35c",
  R: "#00fc03",
  N: "#00eb14",
  D: "#00eb14",
  C: "#0000ff",
  Q: "#00f10e",
  E: "#00f10e",
  G: "#009d62",
  H: "#00d52a",
  I: "#0054ab",
  L: "#007b84",
  K: "#00ff00",
  M: "#009768",
  F: "#008778",
  P: "#00e01f",
  S: "#00d52a",
  T: "#00db24",
  W: "#00a857",
  Y: "#00e619",
  V: "#005fa0",
  B: "#00eb14",
  X: "#00b649",
  Z: "#00f10e",
})

addScheme("Cinema", {
  A: "#bbbbbb",
  B: "grey",
  C: "yellow",
  D: "red",
  E: "red",
  F: "magenta",
  G: "brown",
  H: "#00ffff",
  I: "#bbbbbb",
  J: "#fff",
  K: "#00ffff",
  L: "#bbbbbb",
  M: "#bbbbbb",
  N: "green",
  O: "#fff",
  P: "brown",
  Q: "green",
  R: "#00ffff",
  S: "green",
  T: "green",
  U: "#fff",
  V: "#bbbbbb",
  W: "magenta",
  X: "grey",
  Y: "magenta",
  Z: "grey",
})

addScheme("Clustal", {
  A: "orange",
  B: "#fff",
  C: "green",
  D: "red",
  E: "red",
  F: "blue",
  G: "orange",
  H: "red",
  I: "green",
  J: "#fff",
  K: "red",
  L: "green",
  M: "green",
  N: "#fff",
  O: "#fff",
  P: "orange",
  Q: "#fff",
  R: "red",
  S: "orange",
  T: "orange",
  U: "#fff",
  V: "green",
  W: "blue",
  X: "#fff",
  Y: "blue",
  Z: "#fff",
})

addScheme("Clustal2", {
  A: "#80a0f0",
  R: "#f01505",
  N: "#00ff00",
  D: "#c048c0",
  C: "#f08080",
  Q: "#00ff00",
  E: "#c048c0",
  G: "#f09048",
  H: "#15a4a4",
  I: "#80a0f0",
  L: "#80a0f0",
  K: "#f01505",
  M: "#80a0f0",
  F: "#80a0f0",
  P: "#ffff00",
  S: "#00ff00",
  T: "#00ff00",
  W: "#80a0f0",
  Y: "#15a4a4",
  V: "#80a0f0",
  B: "#fff",
  X: "#fff",
  Z: "#fff",
})

addScheme("Helix Propensity", {
  A: "#e718e7",
  R: "#6f906f",
  N: "#1be41b",
  D: "#778877",
  C: "#23dc23",
  Q: "#926d92",
  E: "#ff00ff",
  G: "#00ff00",
  H: "#758a75",
  I: "#8a758a",
  L: "#ae51ae",
  K: "#a05fa0",
  M: "#ef10ef",
  F: "#986798",
  P: "#00ff00",
  S: "#36c936",
  T: "#47b847",
  W: "#8a758a",
  Y: "#21de21",
  V: "#857a85",
  B: "#49b649",
  X: "#758a75",
  Z: "#c936c9",
})

addScheme("Hydrophobicity", {
  F: "#ff0000",
  I: "#ff0000",
  W: "#ff0606",
  L: "#ff0606",
  V: "#ff4c4c",
  M: "#ff5252",
  Y: "#ff7777",
  C: "#ffa5a5",
  A: "#ffc0c0",
  T: "#e1e1ff",
  H: "#d0d0ff",
  G: "#b6b6ff",
  S: "#a5a5ff",
  Q: "#9595ff",
  R: "#8787ff",
  K: "#6969ff",
  N: "#5959ff",
  E: "#4f4fff",
  P: "#1d1dff",
  D: "#0000ff",
})

addScheme("Lesk", {
  A: "orange",
  B: "#fff",
  C: "green",
  D: "red",
  E: "red",
  F: "green",
  G: "orange",
  H: "magenta",
  I: "green",
  J: "#fff",
  K: "red",
  L: "green",
  M: "green",
  N: "magenta",
  O: "#fff",
  P: "green",
  Q: "magenta",
  R: "red",
  S: "orange",
  T: "orange",
  U: "#fff",
  V: "green",
  W: "green",
  X: "#fff",
  Y: "green",
  Z: "#fff",
})

addScheme("MAE", {
  A: "#77dd88",
  B: "#fff",
  C: "#99ee66",
  D: "#55bb33",
  E: "#55bb33",
  F: "#9999ff",
  G: "#77dd88",
  H: "#5555ff",
  I: "#66bbff",
  J: "#fff",
  K: "#ffcc77",
  L: "#66bbff",
  M: "#66bbff",
  N: "#55bb33",
  O: "#fff",
  P: "#eeaaaa",
  Q: "#55bb33",
  R: "#ffcc77",
  S: "#ff4455",
  T: "#ff4455",
  U: "#fff",
  V: "#66bbff",
  W: "#9999ff",
  X: "#fff",
  Y: "#9999ff",
  Z: "#fff",
})

addScheme("Strand Propensity", {
  A: "#5858a7",
  R: "#6b6b94",
  N: "#64649b",
  D: "#2121de",
  C: "#9d9d62",
  Q: "#8c8c73",
  E: "#0000ff",
  G: "#4949b6",
  H: "#60609f",
  I: "#ecec13",
  L: "#b2b24d",
  K: "#4747b8",
  M: "#82827d",
  F: "#c2c23d",
  P: "#2323dc",
  S: "#4949b6",
  T: "#9d9d62",
  W: "#c0c03f",
  Y: "#d3d32c",
  V: "#ffff00",
  B: "#4343bc",
  X: "#797986",
  Z: "#4747b8",
})

addScheme("Taylor", {
  A: "#ccff00",
  R: "#0000ff",
  N: "#cc00ff",
  D: "#ff0000",
  C: "#ffff00",
  Q: "#ff00cc",
  E: "#ff0066",
  G: "#ff9900",
  H: "#0066ff",
  I: "#66ff00",
  L: "#33ff00",
  K: "#6600ff",
  M: "#00ff00",
  F: "#00ff66",
  P: "#ffcc00",
  S: "#ff3300",
  T: "#ff6600",
  W: "#00ccff",
  Y: "#00ffcc",
  V: "#99ff00",
  B: "#fff",
  X: "#fff",
  Z: "#fff",
})

addScheme("Turn Propensity", {
  A: "#2cd3d3",
  R: "#708f8f",
  N: "#ff0000",
  D: "#e81717",
  C: "#a85757",
  Q: "#3fc0c0",
  E: "#778888",
  G: "#ff0000",
  H: "#708f8f",
  I: "#00ffff",
  L: "#1ce3e3",
  K: "#7e8181",
  M: "#1ee1e1",
  F: "#1ee1e1",
  P: "#f60909",
  S: "#e11e1e",
  T: "#738c8c",
  W: "#738c8c",
  Y: "#9d6262",
  V: "#07f8f8",
  B: "#f30c0c",
  X: "#7c8383",
  Z: "#5ba4a4",
})

addScheme("Zappo", {
  A: "#ffafaf",
  R: "#6464ff",
  N: "#00ff00",
  D: "#ff0000",
  C: "#ffff00",
  Q: "#00ff00",
  E: "#ff0000",
  G: "#ff00ff",
  H: "#6464ff",
  I: "#ffafaf",
  L: "#ffafaf",
  K: "#6464ff",
  M: "#ffafaf",
  F: "#ffc800",
  P: "#ff00ff",
  S: "#00ff00",
  T: "#00ff00",
  W: "#ffc800",
  Y: "#ffc800",
  V: "#ffafaf",
  B: "#fff",
  X: "#fff",
  Z: "#fff",
})

addScheme("Default Nucleotide", {
  A: "#5050ff",
  C: "#e00000",
  G: "#00c000",
  T: "#e6e600",
  U: "#cc9900",
  R: "#2e8b57",
  Y: "#ff8c00",
})

addScheme("Nucleotide 5", {
  A: "#64f73f",
  C: "#ffb340",
  G: "#eb413c",
  T: "#3c88ee",
  U: "#3c88ee",
})

addScheme("Purine/Pyrimidine", {
  A: "#ff83fa",
  C: "#40e0d0",
  G: "#ff83fa",
  R: "#ff83fa",
  T: "#40e0d0",
  U: "#40e0d0",
  Y: "#40e0d0",
})

export { alignmentColorModes, alignmentColorSchema }
export type { TAlignmentColorMode }
