"use client"

import type React from "react"

import { useState } from "react"
import { Upload, FileText, Key, Loader2, CheckCircle, XCircle, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface ExtractionResult {
  fileName: string
  status: "processing" | "completed" | "error"
  data?: any
  error?: string
  extractedText?: string
  entities?: Array<{ type: string; value: string; confidence: number }>
}

export default function DocumentExtractor() {
  const [apiKey, setApiKey] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [results, setResults] = useState<ExtractionResult[]>([])
  const [progress, setProgress] = useState(0)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files)
      setFiles(selectedFiles)
      setResults([])
    }
  }

  const removeFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index)
    setFiles(newFiles)
    if (newFiles.length === 0) {
      setResults([])
    }
  }

  const processFiles = async () => {
    if (!apiKey.trim()) {
      alert("Please enter your LandingAI API key")
      return
    }

    if (files.length === 0) {
      alert("Please select files to process")
      return
    }

    setIsProcessing(true)
    setProgress(0)

    // Initialize results
    const initialResults: ExtractionResult[] = files.map((file) => ({
      fileName: file.name,
      status: "processing",
    }))
    setResults(initialResults)

    try {
      // Process all files in parallel
      const promises = files.map(async (file, index) => {
        try {
          const formData = new FormData()
          formData.append("file", file)
          formData.append("apiKey", apiKey)

          const response = await fetch("/api/extract-document", {
            method: "POST",
            body: formData,
          })

          const result = await response.json()

          if (response.ok) {
            setResults((prev) =>
              prev.map((r, i) =>
                i === index
                  ? {
                      ...r,
                      status: "completed",
                      data: result.data,
                      extractedText: result.extractedText,
                      entities: result.entities,
                    }
                  : r,
              ),
            )
          } else {
            setResults((prev) =>
              prev.map((r, i) =>
                i === index ? { ...r, status: "error", error: result.error || "Processing failed" } : r,
              ),
            )
          }
        } catch (error) {
          setResults((prev) =>
            prev.map((r, i) => (i === index ? { ...r, status: "error", error: "Network error occurred" } : r)),
          )
        }
      })

      // Wait for all files to complete and update progress
      let completed = 0
      const checkProgress = setInterval(() => {
        const currentCompleted = results.filter((r) => r.status !== "processing").length
        if (currentCompleted > completed) {
          completed = currentCompleted
          setProgress((completed / files.length) * 100)
        }
        if (completed >= files.length) {
          clearInterval(checkProgress)
          setProgress(100)
        }
      }, 100)

      await Promise.all(promises)
      clearInterval(checkProgress)
      setProgress(100)
    } finally {
      setIsProcessing(false)
    }
  }

  const downloadResults = () => {
    const completedResults = results.filter((r) => r.status === "completed")
    const dataStr = JSON.stringify(completedResults, null, 2)
    const dataUri = "data:application/json;charset=utf-8," + encodeURIComponent(dataStr)

    const exportFileDefaultName = `extraction-results-${new Date().toISOString().split("T")[0]}.json`

    const linkElement = document.createElement("a")
    linkElement.setAttribute("href", dataUri)
    linkElement.setAttribute("download", exportFileDefaultName)
    linkElement.click()
  }

  const getStatusIcon = (status: ExtractionResult["status"]) => {
    switch (status) {
      case "processing":
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />
    }
  }

  const completedCount = results.filter((r) => r.status === "completed").length
  const errorCount = results.filter((r) => r.status === "error").length

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-gray-900">LandingAI Document Extractor</h1>
          <p className="text-lg text-gray-600">
            Upload multiple documents and extract structured data using LandingAI's agentic extraction
          </p>
        </div>

        {/* API Key Input */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              API Configuration
            </CardTitle>
            <CardDescription>Enter your LandingAI API key to authenticate requests</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="apiKey">LandingAI API Key</Label>
              <Input
                id="apiKey"
                type="password"
                placeholder="Enter your LandingAI API key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="font-mono"
              />
              <p className="text-sm text-gray-500">Your API key is only used for this session and is not stored</p>
            </div>
          </CardContent>
        </Card>

        {/* File Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              File Upload
            </CardTitle>
            <CardDescription>Select multiple documents for extraction (PDF, images, etc.)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                <Input
                  type="file"
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg,.tiff,.bmp"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                />
                <Label htmlFor="file-upload" className="cursor-pointer">
                  <div className="space-y-2">
                    <FileText className="h-12 w-12 mx-auto text-gray-400" />
                    <div className="text-lg font-medium">Choose files to upload</div>
                    <div className="text-sm text-gray-500">Supports PDF, PNG, JPG, JPEG, TIFF, BMP</div>
                  </div>
                </Label>
              </div>

              {files.length > 0 && (
                <div className="space-y-2">
                  <Label>Selected Files ({files.length})</Label>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {files.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          <span className="text-sm font-medium">{file.name}</span>
                          <Badge variant="secondary" className="text-xs">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button
                onClick={processFiles}
                disabled={isProcessing || files.length === 0 || !apiKey.trim()}
                className="w-full"
                size="lg"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing Files...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Extract Data from {files.length} File{files.length !== 1 ? "s" : ""}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Progress */}
        {isProcessing && (
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Processing files...</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="w-full" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {results.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Extraction Results</CardTitle>
                  <CardDescription>
                    {completedCount} completed, {errorCount} errors, {results.length - completedCount - errorCount}{" "}
                    processing
                  </CardDescription>
                </div>
                {completedCount > 0 && (
                  <Button onClick={downloadResults} variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Download Results
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {results.map((result, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(result.status)}
                        <span className="font-medium">{result.fileName}</span>
                        <Badge
                          variant={
                            result.status === "completed"
                              ? "default"
                              : result.status === "error"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {result.status}
                        </Badge>
                      </div>
                    </div>

                    {result.status === "error" && result.error && (
                      <Alert className="mb-3">
                        <XCircle className="h-4 w-4" />
                        <AlertDescription>{result.error}</AlertDescription>
                      </Alert>
                    )}

                    {result.status === "completed" && (
                      <Tabs defaultValue="text" className="w-full">
                        <TabsList>
                          <TabsTrigger value="text">Extracted Text</TabsTrigger>
                          <TabsTrigger value="entities">Entities</TabsTrigger>
                          <TabsTrigger value="raw">Raw Data</TabsTrigger>
                        </TabsList>

                        <TabsContent value="text" className="space-y-2">
                          <Label>Extracted Text</Label>
                          <Textarea
                            value={result.extractedText || "No text extracted"}
                            readOnly
                            className="min-h-[100px] font-mono text-sm"
                          />
                        </TabsContent>

                        <TabsContent value="entities" className="space-y-2">
                          <Label>Detected Entities</Label>
                          {result.entities && result.entities.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {result.entities.map((entity, i) => (
                                <div key={i} className="p-2 bg-gray-50 rounded">
                                  <div className="flex justify-between items-center">
                                    <span className="font-medium">{entity.type}</span>
                                    <Badge variant="outline">{(entity.confidence * 100).toFixed(1)}%</Badge>
                                  </div>
                                  <div className="text-sm text-gray-600">{entity.value}</div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-gray-500">No entities detected</p>
                          )}
                        </TabsContent>

                        <TabsContent value="raw" className="space-y-2">
                          <Label>Raw API Response</Label>
                          <Textarea
                            value={JSON.stringify(result.data, null, 2)}
                            readOnly
                            className="min-h-[200px] font-mono text-xs"
                          />
                        </TabsContent>
                      </Tabs>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
