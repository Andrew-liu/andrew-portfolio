import Foundation
import CoreGraphics
import CoreImage
import ImageIO

func require(_ condition: Bool, _ message: String) {
    if !condition { fputs(message + "\n", stderr); exit(1) }
}
guard CommandLine.arguments.count >= 2,
      let pqSpace = CGColorSpace(name: CGColorSpace.itur_2100_PQ),
      let icc = pqSpace.copyICCData() else { fatalError("Rec.2100 PQ is unavailable") }
let profileURL = URL(fileURLWithPath: CommandLine.arguments[1])
try (icc as Data).write(to: profileURL)
print("Exported native Apple ICC:", pqSpace.name as Any, (icc as Data).count, "bytes")

if CommandLine.arguments.count > 2 {
    let url = URL(fileURLWithPath: CommandLine.arguments[2])
    guard let image = CIImage(contentsOf: url),
          let linear = CGColorSpace(name: CGColorSpace.extendedLinearITUR_2020) else { fatalError("Cannot decode HDR PNG") }
    let name = image.colorSpace?.name as String? ?? "unknown"
    print("CoreImage input color space:", name)
    require(name.contains("ITUR_2100_PQ"), "CoreImage did not recognize ITUR_2100_PQ")
    let context = CIContext(options: [.workingColorSpace: linear, .outputColorSpace: linear])
    func render(_ source: CIImage, _ size: Int) -> [Float] {
        var bitmap = [Float](repeating: 0, count: size*size*4)
        bitmap.withUnsafeMutableBytes { memory in
            context.render(source, toBitmap: memory.baseAddress!, rowBytes: size*4*MemoryLayout<Float>.size,
                           bounds: CGRect(x: 0, y: 0, width: size, height: size), format: .RGBAf, colorSpace: linear)
        }
        return bitmap
    }
    // Compare against a PQ-encoded 203-nit white rendered through the same pipeline.
    // This avoids relying on an undocumented CoreImage linear-white normalization.
    let p = pow(203.0/10000, 2610.0/16384)
    let code = pow((3424.0/4096+(2413.0/128)*p)/(1+(2392.0/128)*p),2523.0/32)
    guard let white = CIColor(red: CGFloat(code), green: CGFloat(code), blue: CGFloat(code), alpha: 1, colorSpace: pqSpace) else { fatalError("Cannot create reference white") }
    let reference = render(CIImage(color: white).cropped(to: CGRect(x: 0,y: 0,width: 1,height: 1)),1)
    let referenceY = Double(reference[0]) * 0.2627 + Double(reference[1]) * 0.6780 + Double(reference[2]) * 0.0593
    require(referenceY > 0, "Invalid reference white")
    for size in [400,48] {
        let transformed = image.transformed(by: CGAffineTransform(scaleX: CGFloat(size)/400, y: CGFloat(size)/400))
        let bitmap = render(transformed,size)
        var peak = 0.0, bright = 0, count = 0
        for y in 0..<size { for x in 0..<size {
            let dx = Double(x)+0.5-Double(size)/2, dy = Double(y)+0.5-Double(size)/2
            if dx*dx+dy*dy > pow(Double(size)/2,2) { continue }
            let i = (y*size+x)*4
            let value = (Double(bitmap[i]) * 0.2627 + Double(bitmap[i+1]) * 0.6780 + Double(bitmap[i+2]) * 0.0593)/referenceY
            require(value.isFinite, "Non-finite HDR pixel")
            peak = max(peak,value); if value > 3 { bright += 1 }; count += 1
        }}
        let area = Double(bright)/Double(count)
        print("CoreImage \(size)px: peak=\(peak)x; area>3x=\(area)")
        require(peak > 9 && peak < 11, "Unexpected HDR peak")
        require(area > 0.4 && area < 0.6, "Unexpected bright area in circular crop")
    }
}
