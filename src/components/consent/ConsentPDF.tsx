/**
 * ConsentPDF — Generación de PDF del consentimiento firmado.
 *
 * Genera un documento PDF que incluye:
 * - Datos del estudiante
 * - Texto completo del consentimiento (según si es adulto o menor)
 * - Firma digitalizada
 * - Fecha de firma
 *
 * Requirement 6.6: Permitir generar un PDF del consentimiento firmado
 * que incluya datos del estudiante, texto completo, firma y fecha.
 */

import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { ConsentConfig } from '@/types/consent';
import type { Student } from '@/types/student';

const PAGE_MARGIN = 20;
const LINE_HEIGHT = 7;
const PAGE_WIDTH = 210; // A4 width in mm
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;

/**
 * Splits text into lines that fit within maxWidth.
 */
function splitTextToLines(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(text, maxWidth) as string[];
}

/**
 * Generates and downloads a PDF document for a signed consent.
 */
export async function generateConsentPDF(
  student: Student,
  config: ConsentConfig,
): Promise<void> {
  const doc = new jsPDF();
  let yPos = PAGE_MARGIN;

  // Helper to add page break if needed
  const checkPageBreak = (neededSpace: number) => {
    if (yPos + neededSpace > 280) {
      doc.addPage();
      yPos = PAGE_MARGIN;
    }
  };

  // --- Header ---
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Consentimiento Informado', PAGE_WIDTH / 2, yPos, { align: 'center' });
  yPos += 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Versión ${config.version}`, PAGE_WIDTH / 2, yPos, { align: 'center' });
  yPos += 15;

  // --- Student Data ---
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Datos del Estudiante', PAGE_MARGIN, yPos);
  yPos += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  const studentData = [
    `Nombre: ${student.firstName} ${student.lastName}`,
    `Documento: ${student.documentId}`,
    `Menor de edad: ${student.isMinor ? 'Sí' : 'No'}`,
  ];

  if (student.isMinor && student.guardianName) {
    studentData.push(`Acudiente: ${student.guardianName}`);
    studentData.push(`Documento acudiente: ${student.guardianDocument}`);
  }

  if (student.consent.byGuardian) {
    studentData.push('Firmado por: Representante legal');
  }

  for (const line of studentData) {
    doc.text(line, PAGE_MARGIN, yPos);
    yPos += LINE_HEIGHT;
  }

  yPos += 5;

  // --- Consent Text ---
  checkPageBreak(20);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Texto del Consentimiento', PAGE_MARGIN, yPos);
  yPos += 8;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');

  const consentText = student.isMinor ? config.minorText : config.text;
  const textLines = splitTextToLines(doc, consentText, CONTENT_WIDTH);

  for (const line of textLines) {
    checkPageBreak(LINE_HEIGHT);
    doc.text(line, PAGE_MARGIN, yPos);
    yPos += LINE_HEIGHT - 1;
  }

  yPos += 10;

  // --- Signature ---
  checkPageBreak(60);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Firma', PAGE_MARGIN, yPos);
  yPos += 8;

  // Add signature image if available
  if (student.consent.signature) {
    try {
      doc.addImage(student.consent.signature, 'PNG', PAGE_MARGIN, yPos, 60, 25);
      yPos += 30;
    } catch {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.text('[Firma digital no disponible para visualización]', PAGE_MARGIN, yPos);
      yPos += LINE_HEIGHT;
    }
  }

  // --- Signature date ---
  yPos += 5;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  const signedDate = student.consent.signedDate
    ? format(new Date(student.consent.signedDate), "d 'de' MMMM 'de' yyyy, HH:mm", { locale: es })
    : 'Fecha no disponible';

  doc.text(`Fecha de firma: ${signedDate}`, PAGE_MARGIN, yPos);
  yPos += LINE_HEIGHT;
  doc.text(`Versión firmada: ${student.consent.signedVersion}`, PAGE_MARGIN, yPos);

  // --- Download ---
  const fileName = `consentimiento_${student.firstName}_${student.lastName}_v${config.version}.pdf`;
  doc.save(fileName.replace(/\s+/g, '_').toLowerCase());
}
