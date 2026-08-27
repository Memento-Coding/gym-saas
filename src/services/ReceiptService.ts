/**
 * ReceiptService — Generación de comprobantes PDF del lado del cliente.
 *
 * Responsabilidades:
 * - Generar comprobantes en PDF usando jsPDF.
 * - Incluir: Logo/Wordmark, número secuencial GOP-XXXX, fecha, datos del cliente,
 *   desglose de conceptos/cantidades/precios, descuento aplicado, total y método de pago.
 * - Para pagos a crédito, incluir plan de cuotas con fechas y saldos pendientes.
 * - Permitir descarga con nombre `comprobante_GOP-XXXX.pdf`.
 *
 * Requirements: 14.1, 14.2, 14.3, 14.4
 */

import { jsPDF } from 'jspdf';
import type { Payment, PaymentMethod } from '@/types/payment';
import type { PaymentCreditPlan } from '@/services/PaymentService';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

/** Datos del cliente para el comprobante */
export interface ReceiptClientInfo {
  name: string;
  documentId: string;
  phone?: string;
  email?: string;
}

/** Línea de concepto en el comprobante */
export interface ReceiptLineItem {
  concept: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

/** Datos completos para generar un comprobante */
export interface ReceiptData {
  receiptNo: string;
  date: string;
  client: ReceiptClientInfo;
  items: ReceiptLineItem[];
  discount: number;
  discountReason?: string;
  total: number;
  method: PaymentMethod;
  splits?: { method: PaymentMethod; amount: number }[];
  creditPlan?: PaymentCreditPlan;
  academyName?: string;
  academyLogo?: string; // Base64 data URL del logo
}

/** Configuración del estilo del PDF */
interface PdfStyle {
  primaryColor: [number, number, number];
  secondaryColor: [number, number, number];
  textColor: [number, number, number];
  lightGray: [number, number, number];
  margin: number;
  lineHeight: number;
}

// ---------------------------------------------------------------------------
// Constantes de estilo
// ---------------------------------------------------------------------------

const STYLE: PdfStyle = {
  primaryColor: [15, 23, 42],       // slate-900
  secondaryColor: [71, 85, 105],    // slate-500
  textColor: [30, 41, 59],          // slate-800
  lightGray: [241, 245, 249],       // slate-100
  margin: 20,
  lineHeight: 6,
};

const DEFAULT_ACADEMY_NAME = 'Meraki Academia de Artes Marciales';

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class ReceiptService {
  /**
   * Genera un comprobante PDF y lo descarga automáticamente en el navegador.
   *
   * @param data Datos completos del comprobante.
   * @returns El nombre del archivo generado.
   */
  static generateAndDownload(data: ReceiptData): string {
    const doc = ReceiptService.generatePdf(data);
    const filename = ReceiptService.getFilename(data.receiptNo);
    doc.save(filename);
    return filename;
  }

  /**
   * Genera un comprobante PDF y retorna el Blob (útil para previews o envío).
   *
   * @param data Datos completos del comprobante.
   * @returns Blob del PDF generado.
   */
  static generateBlob(data: ReceiptData): Blob {
    const doc = ReceiptService.generatePdf(data);
    return doc.output('blob');
  }

  /**
   * Retorna el nombre de archivo esperado para un comprobante.
   */
  static getFilename(receiptNo: string): string {
    return `comprobante_${receiptNo}.pdf`;
  }

  /**
   * Genera el documento jsPDF con todo el contenido del comprobante.
   */
  static generatePdf(data: ReceiptData): jsPDF {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    let y = STYLE.margin;

    // --- Encabezado ---
    y = ReceiptService.drawHeader(doc, data, y, pageWidth);

    // --- Separador ---
    y += 4;
    doc.setDrawColor(...STYLE.lightGray);
    doc.setLineWidth(0.5);
    doc.line(STYLE.margin, y, pageWidth - STYLE.margin, y);
    y += 8;

    // --- Datos del cliente ---
    y = ReceiptService.drawClientInfo(doc, data.client, y);
    y += 6;

    // --- Tabla de conceptos ---
    y = ReceiptService.drawItemsTable(doc, data, y, pageWidth);

    // --- Descuento y total ---
    y = ReceiptService.drawTotals(doc, data, y, pageWidth);
    y += 6;

    // --- Método de pago ---
    const afterMethodY = ReceiptService.drawPaymentMethod(doc, data, y);

    // --- Plan de crédito (si aplica) ---
    if (data.creditPlan) {
      ReceiptService.drawCreditPlan(doc, data.creditPlan, afterMethodY + 8, pageWidth);
    }

    // --- Pie de página ---
    ReceiptService.drawFooter(doc, pageWidth);

    return doc;
  }

  // ---------------------------------------------------------------------------
  // Secciones del PDF
  // ---------------------------------------------------------------------------

  private static drawHeader(
    doc: jsPDF,
    data: ReceiptData,
    startY: number,
    pageWidth: number,
  ): number {
    const y = startY;
    const academyName = data.academyName ?? DEFAULT_ACADEMY_NAME;

    // Logo (si existe)
    if (data.academyLogo) {
      try {
        doc.addImage(data.academyLogo, 'PNG', STYLE.margin, y, 30, 30);
      } catch {
        // Si falla el logo, continuamos sin él
      }
    }

    // Nombre de la academia
    const textX = data.academyLogo ? STYLE.margin + 35 : STYLE.margin;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...STYLE.primaryColor);
    doc.text(academyName, textX, y + 8);

    // Subtítulo
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...STYLE.secondaryColor);
    doc.text('Comprobante de Pago', textX, y + 14);

    // Número de comprobante (derecha)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...STYLE.primaryColor);
    doc.text(data.receiptNo, pageWidth - STYLE.margin, y + 8, { align: 'right' });

    // Fecha (derecha)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...STYLE.secondaryColor);
    const formattedDate = ReceiptService.formatDate(data.date);
    doc.text(formattedDate, pageWidth - STYLE.margin, y + 14, { align: 'right' });

    return y + (data.academyLogo ? 32 : 20);
  }

  private static drawClientInfo(
    doc: jsPDF,
    client: ReceiptClientInfo,
    startY: number,
  ): number {
    let y = startY;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...STYLE.primaryColor);
    doc.text('CLIENTE', STYLE.margin, y);
    y += STYLE.lineHeight;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...STYLE.textColor);
    doc.text(client.name, STYLE.margin, y);
    y += STYLE.lineHeight;

    doc.setFontSize(9);
    doc.setTextColor(...STYLE.secondaryColor);
    doc.text(`Doc: ${client.documentId}`, STYLE.margin, y);
    y += STYLE.lineHeight;

    if (client.phone) {
      doc.text(`Tel: ${client.phone}`, STYLE.margin, y);
      y += STYLE.lineHeight;
    }

    return y;
  }

  private static drawItemsTable(
    doc: jsPDF,
    data: ReceiptData,
    startY: number,
    pageWidth: number,
  ): number {
    let y = startY;
    const tableWidth = pageWidth - STYLE.margin * 2;
    const colWidths = {
      concept: tableWidth * 0.5,
      quantity: tableWidth * 0.15,
      unitPrice: tableWidth * 0.17,
      subtotal: tableWidth * 0.18,
    };

    // Encabezado de tabla
    doc.setFillColor(...STYLE.lightGray);
    doc.rect(STYLE.margin, y - 1, tableWidth, 7, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...STYLE.primaryColor);

    let colX = STYLE.margin + 2;
    doc.text('Concepto', colX, y + 4);
    colX += colWidths.concept;
    doc.text('Cant.', colX, y + 4);
    colX += colWidths.quantity;
    doc.text('Precio Unit.', colX, y + 4);
    colX += colWidths.unitPrice;
    doc.text('Subtotal', colX, y + 4);

    y += 10;

    // Filas
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...STYLE.textColor);

    for (const item of data.items) {
      colX = STYLE.margin + 2;
      doc.text(item.concept, colX, y);
      colX += colWidths.concept;
      doc.text(item.quantity.toString(), colX, y);
      colX += colWidths.quantity;
      doc.text(ReceiptService.formatCurrency(item.unitPrice), colX, y);
      colX += colWidths.unitPrice;
      doc.text(ReceiptService.formatCurrency(item.subtotal), colX, y);
      y += STYLE.lineHeight;
    }

    // Línea separadora bajo la tabla
    y += 2;
    doc.setDrawColor(...STYLE.lightGray);
    doc.line(STYLE.margin, y, pageWidth - STYLE.margin, y);
    y += 4;

    return y;
  }

  private static drawTotals(
    doc: jsPDF,
    data: ReceiptData,
    startY: number,
    pageWidth: number,
  ): number {
    let y = startY;
    const rightX = pageWidth - STYLE.margin;
    const labelX = rightX - 60;

    doc.setFontSize(9);

    // Subtotal (antes de descuento)
    if (data.discount > 0) {
      const subtotal = data.total + data.discount;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...STYLE.secondaryColor);
      doc.text('Subtotal:', labelX, y);
      doc.text(ReceiptService.formatCurrency(subtotal), rightX, y, { align: 'right' });
      y += STYLE.lineHeight;

      // Descuento
      doc.setTextColor(220, 38, 38); // red-600
      const discountText = data.discountReason
        ? `Descuento (${data.discountReason}):`
        : 'Descuento:';
      doc.text(discountText, labelX, y);
      doc.text(`-${ReceiptService.formatCurrency(data.discount)}`, rightX, y, {
        align: 'right',
      });
      y += STYLE.lineHeight + 2;
    }

    // Total
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...STYLE.primaryColor);
    doc.text('TOTAL:', labelX, y);
    doc.text(ReceiptService.formatCurrency(data.total), rightX, y, { align: 'right' });

    return y;
  }

  private static drawPaymentMethod(
    doc: jsPDF,
    data: ReceiptData,
    startY: number,
  ): number {
    let y = startY;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...STYLE.primaryColor);
    doc.text('MÉTODO DE PAGO', STYLE.margin, y);
    y += STYLE.lineHeight;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...STYLE.textColor);

    if (data.splits && data.splits.length > 0) {
      // Pagos divididos
      doc.text('Pago dividido:', STYLE.margin, y);
      y += STYLE.lineHeight;
      for (const split of data.splits) {
        doc.text(
          `  • ${split.method}: ${ReceiptService.formatCurrency(split.amount)}`,
          STYLE.margin,
          y,
        );
        y += STYLE.lineHeight;
      }
    } else {
      doc.text(data.method, STYLE.margin, y);
      y += STYLE.lineHeight;
    }

    return y;
  }

  private static drawCreditPlan(
    doc: jsPDF,
    creditPlan: PaymentCreditPlan,
    startY: number,
    pageWidth: number,
  ): number {
    let y = startY;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...STYLE.primaryColor);
    doc.text('PLAN DE CUOTAS', STYLE.margin, y);
    y += STYLE.lineHeight + 2;

    // Info general
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...STYLE.textColor);
    doc.text(`Abono inicial: ${ReceiptService.formatCurrency(creditPlan.initialPayment)}`, STYLE.margin, y);
    y += STYLE.lineHeight;
    doc.text(`Saldo pendiente: ${ReceiptService.formatCurrency(creditPlan.remainingBalance)}`, STYLE.margin, y);
    y += STYLE.lineHeight + 4;

    // Tabla de cuotas
    const tableWidth = pageWidth - STYLE.margin * 2;
    doc.setFillColor(...STYLE.lightGray);
    doc.rect(STYLE.margin, y - 1, tableWidth, 7, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...STYLE.primaryColor);
    doc.text('#', STYLE.margin + 2, y + 4);
    doc.text('Fecha', STYLE.margin + 15, y + 4);
    doc.text('Monto', STYLE.margin + 55, y + 4);
    doc.text('Estado', STYLE.margin + 90, y + 4);
    y += 10;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...STYLE.textColor);

    for (const installment of creditPlan.installments) {
      doc.text(installment.number.toString(), STYLE.margin + 2, y);
      doc.text(ReceiptService.formatDate(installment.dueDate), STYLE.margin + 15, y);
      doc.text(ReceiptService.formatCurrency(installment.amount), STYLE.margin + 55, y);
      const status = installment.paid ? 'Pagada' : 'Pendiente';
      doc.setTextColor(installment.paid ? 22 : 220, installment.paid ? 163 : 38, installment.paid ? 74 : 38);
      doc.text(status, STYLE.margin + 90, y);
      doc.setTextColor(...STYLE.textColor);
      y += STYLE.lineHeight;
    }

    return y;
  }

  private static drawFooter(doc: jsPDF, pageWidth: number): void {
    const pageHeight = doc.internal.pageSize.getHeight();
    const y = pageHeight - 15;

    doc.setDrawColor(...STYLE.lightGray);
    doc.setLineWidth(0.3);
    doc.line(STYLE.margin, y - 4, pageWidth - STYLE.margin, y - 4);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...STYLE.secondaryColor);
    doc.text(
      'Este comprobante es un documento informativo generado por el sistema GymOps.',
      pageWidth / 2,
      y,
      { align: 'center' },
    );
    doc.text(
      'Conserve este documento como soporte de su transacción.',
      pageWidth / 2,
      y + 4,
      { align: 'center' },
    );
  }

  // ---------------------------------------------------------------------------
  // Utilidades
  // ---------------------------------------------------------------------------

  /**
   * Formatea un monto como moneda COP sin decimales.
   */
  static formatCurrency(amount: number): string {
    return `$${amount.toLocaleString('es-CO')}`;
  }

  /**
   * Formatea una fecha ISO a formato legible dd/mm/yyyy.
   */
  static formatDate(isoDate: string): string {
    const parts = isoDate.split('T')[0].split('-');
    if (parts.length !== 3) return isoDate;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  /**
   * Crea un ReceiptData desde un Payment y datos del estudiante.
   * Método utilitario para facilitar la generación desde la UI.
   */
  static fromPayment(
    payment: Payment,
    client: ReceiptClientInfo,
    creditPlan?: PaymentCreditPlan,
    academyName?: string,
    academyLogo?: string,
  ): ReceiptData {
    const items: ReceiptLineItem[] = [
      {
        concept: `${payment.category === 'mensualidad' ? 'Membresía' : 'Entrenamiento personalizado'} — ${payment.planName}`,
        quantity: 1,
        unitPrice: payment.amount + payment.discount,
        subtotal: payment.amount + payment.discount,
      },
    ];

    return {
      receiptNo: payment.receiptNo ?? 'SIN-NUMERO',
      date: payment.date,
      client,
      items,
      discount: payment.discount,
      discountReason: payment.discountReason || undefined,
      total: payment.amount,
      method: payment.method,
      splits: payment.splits,
      creditPlan,
      academyName,
      academyLogo,
    };
  }
}
