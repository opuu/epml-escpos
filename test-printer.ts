import { EPMLCompiler } from "./src/index.js";
import * as net from "net";

const REMOTE_IMAGE_URL =
  process.env.TEST_IMAGE_URL ||
  "https://dummyimage.com/240x80/000/fff.png?text=EPML";

const INLINE_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAABkBAMAAAAxqGI4AAAAG1BMVEUAAAD///+fn59fX1+/v7/f399/f38/Pz8fHx9jTfECAAAACXBIWXMAAA7EAAAOxAGVKw4bAAACYElEQVRoge2WzW/aMBiHXwgkPtaUUI7NtAyOZWxqj6MKWo+4a1aOCRvZFQT9OKbd2vFnz3ZCSLMkRkVVN+l9pOJg55fHdmxTAARBEARBEARBEARBkFel+ibiqOSe+9mOkprjOCb/87INi83l/K/GZ9DIqxyi5PUlRv9Elov+bY5kBdoxAOnPolvX5S2QVFQp0dgF6/Lyirr0CzwGbhAEKYmtmWwMvmvypy+pyUSp0wt21ttE1RLLA8MNwWiEQAJYOsxxTtOSjzMy1C/hVxtgwvu9bMsIsawkqpboB/zj4RDqn+LKzHRZY4A7i3egFdWRBmj7IkeTqFpSFzfpe1DxCiT8SKgJgRNXvoXaSJQsiaolc/EmyT5U1j3KSkJ+BPEpAjuutKEu+2MlUbXEl1dfoXqQLxHPru7Jh0pWdjxoP4mqJVEHz4GwTrFkFPdGsyk1o2niDeuoWmJRAb/SWfNEIdHcbys+El3MHl8ASVQ9khuB2IbkPfXKJfIE4BVi2V6NU1HlSFLf71vlEjkzvGLYDL43wyfRckkvTFUMSiWGXBtD0No/J+9mmWipZJ7+aRSxYokm34UJ+ihuLvtVfSKpjTISe/M1byRVM9rx2WipxEivDjEKPyySQJMXU17hm87pj0y0VAK9zwDXHtQ7IVmKrt51+fGeL/G7ZHk55deLYMLOkugWEmNAafMoKsQ5oVHaKpDofFeE06jNcJPoVsRL/fdNGMXjMgcjtSnka1fukh1Jju3/XtLb9d/LcjTxsd36fT6V8+PVYnD4shLygVGz87IOwUp9C4IgCIIgCIL8O/wB/k1/H4VYPCMAAAAASUVORK5CYII=";

const template = `
<receipt width="48" init="true">
  <!-- 1. Universal Text Attributes & Fonts -->
  <text align="center" font="b" bold size="2" smoothing>EPML COMPREHENSIVE TEST</text>
  <hr/>
  
  <text align="center" invert full-width padding-top="1" padding-bottom="1">1. TEXT STYLES</text>
  <text align="left">Normal text block aligned left.</text>
  <text align="center" bold>Center aligned and bold.</text>
  <text align="right" underline>Right aligned and underlined.</text>
  <text strike>Strikethrough text.</text>
  <text align="center" upside-down>Upside-down text.</text>
  <text rotate>Rotated 90 degrees.</text>
  <text size-x="2" size-y="1">Double width text.</text>
  <text>Inline <text inline bold>BOLD</text> and <text inline underline>UNDERLINE</text> text.</text>
  <feed lines="1"/>

  <!-- 2. Tables, Rows, Cells -->
  <text align="center" invert full-width padding-top="1" padding-bottom="1">2. TABLES & GRIDS</text>
  <row>
    <cell width="50%" bold>Product</cell>
    <cell width="25%" align="right" bold>QTY</cell>
    <cell width="25%" align="right" bold>Total</cell>
  </row>
  <hr/>
  
  <!-- 3. Control Flow (Loops and Conditionals) & Variables -->
  <for item="item" in="cart.items">
    <row>
      <cell width="50%">{{ item.name }}</cell>
      <cell width="25%" align="right">{{ item.qty }}</cell>
      <cell width="25%" align="right">{{ item.price }}</cell>
    </row>
    <if condition="item.discount">
      <row>
        <cell width="50%" bold>  > Discount</cell>
        <cell width="50%" align="right">{{ item.discount }}</cell>
      </row>
    </if>
  </for>
  <hr/>
  
  <row>
    <cell width="50%" align="left" bold>TAX</cell>
    <cell width="50%" align="right">{{ cart.tax }}</cell>
  </row>
  <row>
    <cell width="50%" align="left" bold>TOTAL</cell>
    <cell width="50%" align="right" bold size="2">{{ cart.total }}</cell>
  </row>
  <feed lines="1"/>

  <!-- 5. Media, Barcodes & Hardware -->
  <text align="center" invert full-width padding-top="1" padding-bottom="1">3. MEDIA & HARDWARE</text>
  
  <text align="center">CODE128 Barcode:</text>
  <barcode type="CODE128" width="2" height="50" hri="below" hri-font="b" align="center">{{ cart.id }}</barcode>
  <feed lines="1"/>

  <text align="center">QR Code:</text>
  <qr size="6" error="M" align="center">https://example.com/</qr>
  <feed lines="1"/>

  <text align="center">PDF417:</text>
  <pdf417 cols="0" rows="0" error="1" truncated="false">SECURE-{{ cart.id }}</pdf417>
  <feed lines="1"/>
  
  <text align="center">Remote Image (URL):</text>
  <image mode="raster" align="center" width="200" dither="floyd-steinberg">{{ assets.remoteImageUrl }}</image>
  <feed lines="1"/>

  <text align="center">Inline Image (Data URL):</text>
  <image mode="raster" align="center" width="96" dither="threshold">{{ assets.inlineDataUrl }}</image>
  <br/>

  <!-- 6. Hardware triggers -->
  <drawer pin="2" on="50" off="50"/>
  <beep count="1" duration="50"/>
  
  <!-- Final Cut -->
  <text align="center">--- END OF RECEIPT ---</text>
  <feed lines="3"/>
  <cut mode="full"/>
</receipt>
`;

const data = {
  cart: {
    id: "TRX-88092",
    tax: "$1.50",
    total: "$25.50",
    items: [
      { name: "Premium Coffee", qty: "2", price: "$10.00" },
      { name: "Blueberry Muffin", qty: "1", price: "$4.00" },
      { name: "Mug (Promo)", qty: "1", price: "$10.00", discount: "-$10.00" },
    ],
  },
  customer: { isMember: false },
  assets: {
    remoteImageUrl: REMOTE_IMAGE_URL,
    inlineDataUrl: INLINE_DATA_URL,
  },
};

async function runTest() {
  console.log("Compiling Comprehensive EPML receipt...");
  try {
    const result = await EPMLCompiler.compileAsync(template, data);

    if (result.warnings.length > 0) {
      console.warn("Compilation Warnings:", result.warnings);
    }

    console.log(`Compiled payload size: ${result.bytes.byteLength} bytes`);

    const PRINTER_IP = process.env.PRINTER_IP || "192.168.1.87";
    const PRINTER_PORT = Number(process.env.PRINTER_PORT) || 9100;

    console.log(
      `Connecting to TCP Printer at ${PRINTER_IP}:${PRINTER_PORT}...`,
    );

    const client = new net.Socket();
    client.connect(PRINTER_PORT, PRINTER_IP, () => {
      console.log("Connected. Sending payload...");
      const buffer = Buffer.from(result.bytes);
      client.write(buffer, (err: Error | null | undefined) => {
        if (err) console.error("Write error:", err);
        else console.log("Success!");
        client.destroy();
      });
    });

    client.on("error", (err: Error) => {
      console.error("TCP Error:", err.message);
      client.destroy();
    });
  } catch (e: any) {
    console.error("Fatal Error:", e.stack);
  }
}

runTest();
