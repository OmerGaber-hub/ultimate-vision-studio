import jsPDF from "jspdf";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  AlignmentType,
  HeadingLevel,
} from "docx";

export interface DocumentExportOptions {
  projectName?: string;
  docWidth: number;
  docHeight: number;
  textContents?: string[];
  includeTextSection?: boolean;
}

/**
 * Exports the given canvas as a high-resolution, perfectly-dimensioned PDF.
 */
export async function exportToPDF(
  canvas: HTMLCanvasElement,
  options: DocumentExportOptions
): Promise<void> {
  const { projectName, docWidth, docHeight } = options;
  const fileName = `${projectName ? projectName.replace(/[\s/\\?%*:|"<>]/g, "_") : "vision_studio"}_${Date.now()}.pdf`;

  const isLandscape = docWidth > docHeight;

  // Create a PDF document matching canvas dimensions in px
  const pdf = new jsPDF({
    orientation: isLandscape ? "landscape" : "portrait",
    unit: "px",
    format: [docWidth, docHeight],
    hotfixes: ["px_scaling"],
  });

  pdf.setProperties({
    title: projectName || "Ultimate Vision Studio Artwork",
    subject: "Image Export from Ultimate Vision Studio",
    author: "Ultimate Vision Studio",
    creator: "Ultimate Vision Studio",
  });

  // Convert canvas to high-quality PNG
  const imgData = canvas.toDataURL("image/png");
  pdf.addImage(imgData, "PNG", 0, 0, docWidth, docHeight, undefined, "FAST");

  pdf.save(fileName);
}

/**
 * Exports the given canvas as a formatted Word (.docx) document
 * with title, artwork image centered to printable margins, dimensions, and optional text layers.
 */
export async function exportToWord(
  canvas: HTMLCanvasElement,
  options: DocumentExportOptions
): Promise<void> {
  const { projectName, docWidth, docHeight, textContents, includeTextSection } = options;
  const fileName = `${projectName ? projectName.replace(/[\s/\\?%*:|"<>]/g, "_") : "vision_studio"}_${Date.now()}.docx`;

  // Convert canvas to Uint8Array buffer
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), "image/png");
  });

  if (!blob) {
    throw new Error("تعذر تحويل الصورة إلى بيانات ثنائية.");
  }

  const arrayBuffer = await blob.arrayBuffer();
  const imageBuffer = new Uint8Array(arrayBuffer);

  // Calculate printable dimensions to fit standard A4 page (width ~550px max, height ~720px max)
  const maxPrintableWidth = 550;
  const maxPrintableHeight = 720;
  const scale = Math.min(
    maxPrintableWidth / docWidth,
    maxPrintableHeight / docHeight,
    1
  );

  const displayWidth = Math.max(100, Math.round(docWidth * scale));
  const displayHeight = Math.max(80, Math.round(docHeight * scale));

  const paragraphs: Paragraph[] = [
    // Document Title
    new Paragraph({
      text: projectName || "تصميم استوديو الرؤية - Ultimate Vision Studio",
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
    }),

    // Subtitle / Metadata
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [
        new TextRun({
          text: `تم التصدير بواسطة Ultimate Vision Studio • الأبعاد الأصلية: ${docWidth} × ${docHeight} بكسل`,
          italics: true,
          color: "64748b",
          size: 20, // 10pt
        }),
      ],
    }),

    // Centered Artwork Image
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
      children: [
        new ImageRun({
          type: "png",
          data: imageBuffer,
          transformation: {
            width: displayWidth,
            height: displayHeight,
          },
        }),
      ],
    }),
  ];

  // Optional: append extracted or added text layers if requested
  if (includeTextSection && textContents && textContents.length > 0) {
    paragraphs.push(
      new Paragraph({
        text: "النصوص والمحتوى النصي في العمل:",
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 240, after: 120 },
      })
    );

    for (const txt of textContents) {
      if (!txt || !txt.trim()) continue;
      paragraphs.push(
        new Paragraph({
          spacing: { after: 80 },
          children: [
            new TextRun({
              text: "• " + txt.trim(),
              size: 22, // 11pt
              color: "1e293b",
            }),
          ],
        })
      );
    }
  }

  // Footer stamp
  paragraphs.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 360 },
      children: [
        new TextRun({
          text: `تاريخ التصدير: ${new Date().toLocaleDateString("ar-SA", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}`,
          size: 18, // 9pt
          color: "94a3b8",
        }),
      ],
    })
  );

  const doc = new Document({
    title: projectName || "Ultimate Vision Studio",
    description: "Exported artwork document",
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440, // 1 inch
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        children: paragraphs,
      },
    ],
  });

  const docBlob = await Packer.toBlob(doc);
  const downloadUrl = URL.createObjectURL(docBlob);
  const a = document.createElement("a");
  a.href = downloadUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(downloadUrl);
  }, 200);
}
