use wasm_bindgen::prelude::*;

/// Render SVG string to PNG bytes at specified dimensions
#[wasm_bindgen]
pub fn svg_to_png(svg_data: &str, width: u32, height: u32) -> Result<Vec<u8>, JsError> {
    let opt = usvg::Options::default();
    let tree = usvg::Tree::from_str(svg_data, &opt)
        .map_err(|e| JsError::new(&format!("SVG parse error: {}", e)))?;

    let mut pixmap = resvg::tiny_skia::Pixmap::new(width, height)
        .ok_or_else(|| JsError::new("Failed to create pixmap"))?;

    let scale_x = width as f32 / tree.size().width();
    let scale_y = height as f32 / tree.size().height();
    let scale = scale_x.min(scale_y);

    resvg::render(
        &tree,
        usvg::Transform::from_scale(scale, scale),
        &mut pixmap.as_mut(),
    );

    pixmap.encode_png()
        .map_err(|e| JsError::new(&format!("PNG encode error: {}", e)))
}

/// Get SVG dimensions
#[wasm_bindgen]
pub fn svg_info(svg_data: &str) -> Result<JsValue, JsError> {
    let opt = usvg::Options::default();
    let tree = usvg::Tree::from_str(svg_data, &opt)
        .map_err(|e| JsError::new(&format!("SVG parse error: {}", e)))?;

    serde_wasm_bindgen::to_value(&(tree.size().width(), tree.size().height()))
        .map_err(|e| JsError::new(&e.to_string()))
}
