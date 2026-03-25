use wasm_bindgen::prelude::*;
use serde::Serialize;
use std::io::Cursor;

#[derive(Serialize)]
pub struct ImageInfo {
    pub width: u32,
    pub height: u32,
    pub format: String,
    pub mime: String,
    pub color_type: String,
    pub has_alpha: bool,
    pub exif: Vec<ExifEntry>,
}

#[derive(Serialize)]
pub struct ExifEntry {
    pub tag: String,
    pub value: String,
}

/// Extract full image metadata including EXIF
#[wasm_bindgen]
pub fn get_image_info(input: &[u8]) -> Result<JsValue, JsError> {
    let reader = image::ImageReader::new(Cursor::new(input))
        .with_guessed_format()
        .map_err(|e| JsError::new(&format!("Format detection failed: {}", e)))?;

    let format_str = reader
        .format()
        .map(|f| format!("{:?}", f))
        .unwrap_or_else(|| "Unknown".to_string());

    let img = reader
        .decode()
        .map_err(|e| JsError::new(&format!("Decode failed: {}", e)))?;

    let mime = crate::convert::detect_mime_from_bytes(input);
    let has_alpha = img.color().has_alpha();
    let color_type = format!("{:?}", img.color());

    // Extract EXIF data using kamadak-exif (imported as `exif`)
    let mut exif_entries = Vec::new();
    if let Ok(exif_reader) = exif::Reader::new().read_from_container(&mut Cursor::new(input)) {
        for field in exif_reader.fields() {
            exif_entries.push(ExifEntry {
                tag: format!("{}", field.tag),
                value: field.display_value().with_unit(&exif_reader).to_string(),
            });
        }
    }

    let info = ImageInfo {
        width: img.width(),
        height: img.height(),
        format: format_str,
        mime,
        color_type,
        has_alpha,
        exif: exif_entries,
    };

    serde_wasm_bindgen::to_value(&info)
        .map_err(|e| JsError::new(&e.to_string()))
}

/// Extract just the EXIF data as JSON
#[wasm_bindgen]
pub fn get_exif(input: &[u8]) -> Result<JsValue, JsError> {
    let mut entries = Vec::new();

    if let Ok(exif_reader) = exif::Reader::new().read_from_container(&mut Cursor::new(input)) {
        for field in exif_reader.fields() {
            entries.push(ExifEntry {
                tag: format!("{}", field.tag),
                value: field.display_value().with_unit(&exif_reader).to_string(),
            });
        }
    }

    serde_wasm_bindgen::to_value(&entries)
        .map_err(|e| JsError::new(&e.to_string()))
}

/// Get image dimensions without fully decoding
#[wasm_bindgen]
pub fn get_dimensions(input: &[u8]) -> Result<JsValue, JsError> {
    let reader = image::ImageReader::new(Cursor::new(input))
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
    crate::convert::detect_mime_from_bytes(input)
}
