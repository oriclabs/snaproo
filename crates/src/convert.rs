use wasm_bindgen::prelude::*;
use image::{DynamicImage, ImageFormat, ImageReader};
use std::io::Cursor;

/// Convert image bytes from one format to another
/// Returns the converted image as a byte array
#[wasm_bindgen]
pub fn convert_image(input: &[u8], output_format: &str, quality: u8) -> Result<Vec<u8>, JsError> {
    let reader = ImageReader::new(Cursor::new(input))
        .with_guessed_format()
        .map_err(|e| JsError::new(&format!("Failed to detect format: {}", e)))?;

    let img = reader
        .decode()
        .map_err(|e| JsError::new(&format!("Failed to decode image: {}", e)))?;

    let format = match output_format.to_lowercase().as_str() {
        "png" => ImageFormat::Png,
        "jpeg" | "jpg" => ImageFormat::Jpeg,
        "webp" => ImageFormat::WebP,
        "bmp" => ImageFormat::Bmp,
        "gif" => ImageFormat::Gif,
        "tiff" | "tif" => ImageFormat::Tiff,
        "tga" => ImageFormat::Tga,
        "qoi" => ImageFormat::Qoi,
        "ico" => ImageFormat::Ico,
        _ => return Err(JsError::new(&format!("Unsupported format: {}", output_format))),
    };

    let mut output = Vec::new();
    img.write_to(&mut Cursor::new(&mut output), format)
        .map_err(|e| JsError::new(&format!("Failed to encode: {}", e)))?;

    Ok(output)
}

/// Get image dimensions without fully decoding
#[wasm_bindgen]
pub fn get_dimensions(input: &[u8]) -> Result<JsValue, JsError> {
    let reader = ImageReader::new(Cursor::new(input))
        .with_guessed_format()
        .map_err(|e| JsError::new(&format!("Format detection failed: {}", e)))?;
    let (w, h) = reader.into_dimensions()
        .map_err(|e| JsError::new(&format!("Failed to get dimensions: {}", e)))?;
    serde_wasm_bindgen::to_value(&(w, h))
        .map_err(|e| JsError::new(&e.to_string()))
}

/// Detect MIME type from image bytes
#[wasm_bindgen]
pub fn detect_mime(input: &[u8]) -> String {
    detect_mime_from_bytes(input)
}

/// Get supported input formats
#[wasm_bindgen]
pub fn supported_input_formats() -> Vec<JsValue> {
    vec![
        "PNG", "JPEG", "GIF", "WebP", "BMP", "TIFF", "TGA", "QOI",
        "ICO", "PNM", "DDS", "EXR", "HDR", "AVIF", "SVG",
    ]
    .into_iter()
    .map(|s| JsValue::from_str(s))
    .collect()
}

/// Get supported output formats
#[wasm_bindgen]
pub fn supported_output_formats() -> Vec<JsValue> {
    vec![
        "PNG", "JPEG", "WebP", "BMP", "GIF", "TIFF", "TGA", "QOI", "ICO",
    ]
    .into_iter()
    .map(|s| JsValue::from_str(s))
    .collect()
}

/// Simple MIME detection from magic bytes (no filesystem dependency)
pub fn detect_mime_from_bytes(input: &[u8]) -> String {
    if input.len() < 4 { return "application/octet-stream".to_string(); }
    match &input[..4] {
        [0x89, 0x50, 0x4E, 0x47] => "image/png",
        [0xFF, 0xD8, 0xFF, _] => "image/jpeg",
        [0x47, 0x49, 0x46, _] => "image/gif",
        [0x42, 0x4D, _, _] => "image/bmp",
        [0x52, 0x49, 0x46, 0x46] => {
            if input.len() >= 12 && &input[8..12] == b"WEBP" { "image/webp" } else { "application/octet-stream" }
        },
        [0x49, 0x49, _, _] | [0x4D, 0x4D, _, _] => "image/tiff",
        [0x00, 0x00, 0x01, 0x00] => "image/x-icon",
        _ => {
            if input.len() >= 12 && &input[4..12] == b"ftypavif" { "image/avif" }
            else if input.starts_with(b"qoif") { "image/qoi" }
            else { "application/octet-stream" }
        }
    }.to_string()
}
