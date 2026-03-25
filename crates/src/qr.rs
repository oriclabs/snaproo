use wasm_bindgen::prelude::*;
use qrcodegen::{QrCode, QrCodeEcc};

/// Generate QR code as a grid of boolean modules (true = dark)
/// Returns flat array of bools with size as first element
#[wasm_bindgen]
pub fn generate_qr(text: &str, error_correction: &str) -> Result<JsValue, JsError> {
    let ecc = match error_correction.to_uppercase().as_str() {
        "L" => QrCodeEcc::Low,
        "M" => QrCodeEcc::Medium,
        "Q" => QrCodeEcc::Quartile,
        "H" => QrCodeEcc::High,
        _ => QrCodeEcc::Medium,
    };

    let qr = QrCode::encode_text(text, ecc)
        .map_err(|e| JsError::new(&format!("QR generation failed: {:?}", e)))?;

    let size = qr.size() as usize;
    let mut modules = Vec::with_capacity(size * size);

    for y in 0..size {
        for x in 0..size {
            modules.push(qr.get_module(x as i32, y as i32));
        }
    }

    let result = serde_wasm_bindgen::to_value(&(size, modules))
        .map_err(|e| JsError::new(&e.to_string()))?;
    Ok(result)
}

/// Generate QR code as SVG string
#[wasm_bindgen]
pub fn generate_qr_svg(
    text: &str,
    error_correction: &str,
    fg_color: &str,
    bg_color: &str,
    margin: u32,
) -> Result<String, JsError> {
    let ecc = match error_correction.to_uppercase().as_str() {
        "L" => QrCodeEcc::Low,
        "M" => QrCodeEcc::Medium,
        "Q" => QrCodeEcc::Quartile,
        "H" => QrCodeEcc::High,
        _ => QrCodeEcc::Medium,
    };

    let qr = QrCode::encode_text(text, ecc)
        .map_err(|e| JsError::new(&format!("QR generation failed: {:?}", e)))?;

    let size = qr.size() as u32;
    let total = size + margin * 2;

    let mut svg = format!(
        r#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {total} {total}" shape-rendering="crispEdges">"#
    );
    svg.push_str(&format!(
        r#"<rect width="{total}" height="{total}" fill="{bg_color}"/>"#
    ));

    for y in 0..size {
        for x in 0..size {
            if qr.get_module(x as i32, y as i32) {
                svg.push_str(&format!(
                    r#"<rect x="{}" y="{}" width="1" height="1" fill="{fg_color}"/>"#,
                    x + margin,
                    y + margin
                ));
            }
        }
    }

    svg.push_str("</svg>");
    Ok(svg)
}

/// Generate QR code as PNG bytes
#[wasm_bindgen]
pub fn generate_qr_png(
    text: &str,
    error_correction: &str,
    pixel_size: u32,
    margin: u32,
) -> Result<Vec<u8>, JsError> {
    let ecc = match error_correction.to_uppercase().as_str() {
        "L" => QrCodeEcc::Low,
        "M" => QrCodeEcc::Medium,
        "Q" => QrCodeEcc::Quartile,
        "H" => QrCodeEcc::High,
        _ => QrCodeEcc::Medium,
    };

    let qr = QrCode::encode_text(text, ecc)
        .map_err(|e| JsError::new(&format!("QR generation failed: {:?}", e)))?;

    let size = qr.size() as u32;
    let img_size = (size + margin * 2) * pixel_size;

    let mut imgbuf = image::ImageBuffer::new(img_size, img_size);

    // Fill white background
    for pixel in imgbuf.pixels_mut() {
        *pixel = image::Rgb([255u8, 255, 255]);
    }

    // Draw QR modules
    for y in 0..size {
        for x in 0..size {
            if qr.get_module(x as i32, y as i32) {
                for py in 0..pixel_size {
                    for px in 0..pixel_size {
                        let ix = (x + margin) * pixel_size + px;
                        let iy = (y + margin) * pixel_size + py;
                        imgbuf.put_pixel(ix, iy, image::Rgb([0u8, 0, 0]));
                    }
                }
            }
        }
    }

    let mut output = Vec::new();
    let mut cursor = std::io::Cursor::new(&mut output);
    imgbuf.write_to(&mut cursor, image::ImageFormat::Png)
        .map_err(|e| JsError::new(&format!("PNG encode failed: {}", e)))?;

    Ok(output)
}

// QR reading handled by bundled jsQR in JavaScript (no rxing dependency)
