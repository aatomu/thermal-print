// @ts-check

/** 
 * @typedef {object} SerialPort
 * @property {WritableStream} writable
 * @property {(options: { baudRate: number }) => Promise<void>} open
 * @property {() => Promise<void>} close
 */

class ThermalPrinter {
  /** @type {SerialPort|null}*/
  printer = null
  /** @type {WritableStreamDefaultWriter|null}*/
  writer = null
  queue = []

  constructor() {
    this.printer = null
    this.writer = null
    this.queue = []
  }

  async connect(bps = 9600) {
    // @ts-expect-error
    this.printer = await navigator.serial.requestPort();
    if (this.printer == null) {
      console.error("Failed connect to printer!!")
      return
    }
    await this.printer.open({ baudRate: bps });
    this.writer = this.printer.writable.getWriter();
  }

  async disconnect() {
    if (!this.printer || !this.writer) {
      console.error("Printer is not connected")
      return
    }
    this.writer.releaseLock();
    await this.printer.close();

    this.printer = null
    this.writer = null
    this.queue = []
  }

  async send() {
    if (!this.writer) {
      console.error("Serial connection is notfound")
      return
    }
    const data = new Uint8Array(this.queue)
    this.writer.write(data)
    console.log("Sent binary:", data)
    this.queue = []
  }

  //#region Print
  Print_NewLine() {
    // LF
    this.queue.push(...[0x0A])
  }
  Print_pageToStandard() {
    // ESC FF
    this.queue.push(...[0x0C])
  }
  Print_Return() {
    // CR
    this.queue.push(...[0x0D])
  }
  Print_Page() {
    // ESC FF
    this.queue.push(...[0x1B, 0x0C])
  }
  Print_Feed(n) {
    // ESC J n
    this.queue.push(...[0x1B, 0x4A, n])
  }
  Print_FeedBack(n) {
    // ESC K n
    this.queue.push(...[0x1B, 0x4B, n])
  }
  Print_FeedLine(n) {
    // ESC d n
    this.queue.push(...[0x1B, 0x64, n])
  }
  Print_FeedLineBack(n) {
    // ESC e n
    this.queue.push(...[0x1B, 0x65, n])
  }
  //#endregion

  //#region New Line Value
  LineValue_Reset() {
    // ESC 2 n
    this.queue.push(...[0x1B, 32])
  }
  LineValue_Set(n) {
    // ESC 3 n
    this.queue.push(...[0x1B, 0x33, n])
  }
  //#endregion

  //#region Text
  Text_pageCancel() {
    // CAN
    this.queue.push(...[0x18])
  }
  Text_SetRightSpace(n) {
    // ESC SP n
    this.queue.push(...[0x1B, 0x20, n])
  }
  Text_AllConfig(font, bold, heightZoom, widthZoom, underline) {
    // ESC ! n
    let n = 0
    n |= font << 0
    n |= bold << 3
    n |= heightZoom << 4
    n |= widthZoom << 5
    n |= underline << 7
    this.queue.push(...[0x1B, 0x21, n])
  }
  Text_Underline(n) {
    // ESC - n
    this.queue.push(...[0x1B, 0x2D, n])
  }
  Text_Bold(n) {
    // ESC E n
    this.queue.push(...[0x1B, 0x45, n])
  }
  Text_Double(n) {
    // ESC G n
    this.queue.push(...[0x1B, 0x47, n])
  }
  Text_Font(n) {
    // ESC M n
    this.queue.push(...[0x1B, 0x4D, n])
  }
  Text_Language(n) {
    // ESC R n
    this.queue.push(...[0x1B, 0x52, n])
  }
  Text_Rotate(n) {
    // ESC V n
    this.queue.push(...[0x1B, 0x56, n])
  }
  Text_Color(n) {
    // ESC r n
    this.queue.push(...[0x1B, 0x72, n])
  }
  Text_Code(n) {
    // ESC t n
    this.queue.push(...[0x1B, 0x74, n])
  }
  Text_Size(height, width) {
    // ESC { n
    let n = ((height & 0b0111) << 4) | width & 0b0111
    this.queue.push(...[0x1B, 0x7B, n])
  }
  Text_Reverse(n) {
    // ESC B n
    this.queue.push(...[0x1B, 0x42, n])
  }
  Text_Smoothing(n) {
    // ESC b n
    this.queue.push(...[0x1B, 0x62, n])
  }
  //#endregion

  //#region Position
  Position_Tab() {
    // HT
    this.queue.push(...[0x09])
  }
  Position_AbsoluteByLeft(n) {
    // ESC $ nL nH
    let nL = n % 256
    let nH = (n - nL) / 256
    this.queue.push(...[0x1B, 0x24, nL, nH])
  }
  // Position_TabConfig(n) {
  //   // ESC D
  // }
  Position_pageFacing(n) {
    // ESC T n
    this.queue.push(...[0x1B, 0x54, n])
  }
  // Position_pagePrintArea(n) {
  //   // ESC W
  // }
  Position_Relative(n) {
    // ESC \ nL nH
    let nL = n % 256
    let nH = (n - nL) / 256
    this.queue.push(...[0x1B, 0x5C, nL, nH])
  }
  Position_Align(n) {
    // ESC a n
    this.queue.push(...[0x1B, 0x61, n])
  }
  // Position_pageAbsoluteByTop(n) {
  //   // GS $
  // }
  Position_LeftMargin(n) {
    // GS L
    let nL = n % 256
    let nH = (n - nL) / 256
    this.queue.push(...[0x1D, 0x4C, nL, nH])
  }
  Position_LineTop() {
    // GS T
    this.queue.push(...[0x1D, 0x54])
  }
  // Position_PrintArea(n) {
  //   // GS W
  // }
  // Position_pageRelative(n) {
  //   // GS \
  // }
  //#endregion

  //#region Bit Image
  BitImage_Print(mode, width, binary) {
    // ESC * m nL nH d1...dn
    if (binary.length > 0xffff) {
      console.error("image []bytes required less than 0xffff")
    }

    if (mode == 32 || mode == 33) {
      if (binary.length % 3 != 0) {
        console.error("ImageModeHeight24 is image []bytes required 3n length")
        return
      }
    }


    let nL = width % 256
    let nH = (width - nL) / 256
    this.queue.push(...[0x1B, 0x2A, mode, nL, nH])
    this.queue.push(...binary)
  }
  //#endregion

  //#region Barcode
  Barcode_TextPosition(n) {
    // ESC H n
    this.queue.push(...[0x1D, 0x48, n])
  }
  Barcode_Height(n) {
    // ESC h n
    this.queue.push(...[0x1D, 0x68, n])
  }
  Barcode_Print(id) {
    // ESC k m d1...dn NUL
    this.queue.push(...[0x1D, 0x6B, 0x02])
    this.queue.push(...this.str2byte(id))
    this.queue.push(0x00)
  }
  Barcode_Width(n) {
    // ESC w n
    this.queue.push(...[0x1D, 0x77, n])
  }
  //#endregion

  //#region QRcode
  QRcode_Print(dotSize, level, url) {
    // GS ( k pL pH cn fn...
    // QRcode Model
    this.queue.push(...[0x1D, 0x28, 0x6B, 0x04, 0x00, 49, 65, 50, 0])
    // QRcode Dot Size
    this.queue.push(...[0x1D, 0x28, 0x6B, 0x03, 0x00, 49, 67, dotSize])
    // QRcode Error Level
    this.queue.push(...[0x1D, 0x28, 0x6B, 0x03, 0x00, 49, 69, level + 48])
    // QRcode Input
    let length = url.length + 3
    let pL = length % 256
    let pH = (length - pL) / 256
    this.queue.push(...[0x1D, 0x28, 0x6B, pL, pH, 49, 80, 48])
    this.queue.push(...this.str2byte(url))
    // QRcode Print
    this.queue.push(...[0x1D, 0x28, 0x6B, 0x03, 0x00, 49, 81, 48])
  }
  // #endregion

  //#region Sub system
  ResetSetting() {
    this.queue.push(...[0x1B, 0x40])
  }
  ToPageMode() {
    this.queue.push(...[0x1B, 0x4C])
  }
  ToStandardMode() {
    this.queue.push(...[0x1B, 0x4C])
  }
  SetDefaultPitch(x, y) {
    this.queue.push(...[0x1D, 0x50, x, y])
  }

  str2byte(text) {
    return Array.from(new TextEncoder().encode(text))
  }
}
