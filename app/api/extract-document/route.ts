import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const apiKey = formData.get("apiKey") as string

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    if (!apiKey) {
      return NextResponse.json({ error: "No API key provided" }, { status: 400 })
    }

    // Convert file to base64 for API transmission
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64File = buffer.toString("base64")

    // Try multiple LandingAI API formats
    let landingAIResponse: Response

    // Format 1: Try with apikey header (most common for LandingAI)
    try {
      landingAIResponse = await fetch("https://predict.app.landing.ai/inference/v1/predict", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: apiKey,
        },
        body: JSON.stringify({
          type: "file_upload",
          images: [
            {
              type: "base64",
              value: base64File,
            },
          ],
        }),
      })

      if (landingAIResponse.status === 401) {
        // Format 2: Try with Authorization Bearer
        landingAIResponse = await fetch("https://predict.app.landing.ai/inference/v1/predict", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            type: "file_upload",
            images: [
              {
                type: "base64",
                value: base64File,
              },
            ],
          }),
        })
      }

      if (landingAIResponse.status === 401) {
        // Format 3: Try with API-Key header
        landingAIResponse = await fetch("https://predict.app.landing.ai/inference/v1/predict", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "API-Key": apiKey,
          },
          body: JSON.stringify({
            type: "file_upload",
            images: [
              {
                type: "base64",
                value: base64File,
              },
            ],
          }),
        })
      }

      if (landingAIResponse.status === 401) {
        // Format 4: Try different endpoint structure
        landingAIResponse = await fetch("https://predict.app.landing.ai/inference/v1/predict", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: apiKey,
          },
          body: JSON.stringify({
            file: base64File,
            filename: file.name,
            filetype: file.type,
          }),
        })
      }

      if (landingAIResponse.status === 401) {
        // Format 5: Try with query parameter
        landingAIResponse = await fetch(`https://predict.app.landing.ai/inference/v1/predict?apikey=${apiKey}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: "file_upload",
            images: [
              {
                type: "base64",
                value: base64File,
              },
            ],
          }),
        })
      }
    } catch (fetchError) {
      console.error("Fetch error:", fetchError)
      return NextResponse.json({ error: "Network error occurred" }, { status: 500 })
    }

    if (!landingAIResponse.ok) {
      const errorText = await landingAIResponse.text()
      console.error("LandingAI API Error:", errorText)

      if (landingAIResponse.status === 401) {
        return NextResponse.json(
          {
            error: "Invalid API key or authentication failed. Please check your LandingAI API key.",
          },
          { status: 401 },
        )
      }

      if (landingAIResponse.status === 403) {
        return NextResponse.json(
          {
            error: "Access forbidden. Please check your API key permissions.",
          },
          { status: 403 },
        )
      }

      return NextResponse.json(
        {
          error: `LandingAI API error (${landingAIResponse.status}): ${errorText}`,
        },
        { status: 500 },
      )
    }

    const result = await landingAIResponse.json()

    // Process and structure the response
    const processedResult = {
      data: result,
      extractedText: extractTextFromResult(result),
      entities: extractEntitiesFromResult(result),
      fileName: file.name,
      fileSize: file.size,
      processedAt: new Date().toISOString(),
    }

    return NextResponse.json(processedResult)
  } catch (error) {
    console.error("Document extraction error:", error)
    return NextResponse.json(
      {
        error: "Failed to process document: " + (error instanceof Error ? error.message : "Unknown error"),
      },
      { status: 500 },
    )
  }
}

// Helper function to extract text from LandingAI response
function extractTextFromResult(result: any): string {
  try {
    // Handle different LandingAI response structures
    if (result.predictions && result.predictions.length > 0) {
      const prediction = result.predictions[0]

      // Try different possible text fields
      if (prediction.extracted_text) {
        return prediction.extracted_text
      }

      if (prediction.ocr_text) {
        return prediction.ocr_text
      }

      if (prediction.text) {
        return prediction.text
      }

      // If text is in segments, combine them
      if (prediction.text_segments && Array.isArray(prediction.text_segments)) {
        return prediction.text_segments.map((segment: any) => segment.text || segment).join(" ")
      }

      // Try to extract from bounding boxes or regions
      if (prediction.regions && Array.isArray(prediction.regions)) {
        return prediction.regions.map((region: any) => region.text || region.value || "").join(" ")
      }
    }

    // Handle direct text response
    if (result.text) {
      return result.text
    }

    // Handle OCR response
    if (result.ocr_result) {
      return result.ocr_result
    }

    return "No text extracted"
  } catch (error) {
    console.error("Error extracting text:", error)
    return "Error extracting text"
  }
}

// Helper function to extract entities from LandingAI response
function extractEntitiesFromResult(result: any): Array<{ type: string; value: string; confidence: number }> {
  try {
    const entities: Array<{ type: string; value: string; confidence: number }> = []

    if (result.predictions && result.predictions.length > 0) {
      const prediction = result.predictions[0]

      // Extract entities based on LandingAI's response structure
      if (prediction.entities && Array.isArray(prediction.entities)) {
        prediction.entities.forEach((entity: any) => {
          entities.push({
            type: entity.type || entity.label || entity.class || "Unknown",
            value: entity.value || entity.text || entity.content || "",
            confidence: entity.confidence || entity.score || entity.probability || 0,
          })
        })
      }

      // Extract key-value pairs if available
      if (prediction.key_value_pairs && Array.isArray(prediction.key_value_pairs)) {
        prediction.key_value_pairs.forEach((pair: any) => {
          entities.push({
            type: pair.key || "Key-Value",
            value: pair.value || "",
            confidence: pair.confidence || 0,
          })
        })
      }

      // Extract tables if available
      if (prediction.tables && Array.isArray(prediction.tables)) {
        prediction.tables.forEach((table: any, index: number) => {
          entities.push({
            type: "Table",
            value: `Table ${index + 1} (${table.rows?.length || table.data?.length || 0} rows)`,
            confidence: table.confidence || 0,
          })
        })
      }

      // Extract bounding boxes as entities
      if (prediction.bounding_boxes && Array.isArray(prediction.bounding_boxes)) {
        prediction.bounding_boxes.forEach((box: any, index: number) => {
          entities.push({
            type: box.label || box.class || "Detection",
            value: box.text || box.value || `Detection ${index + 1}`,
            confidence: box.confidence || box.score || 0,
          })
        })
      }
    }

    return entities
  } catch (error) {
    console.error("Error extracting entities:", error)
    return []
  }
}
