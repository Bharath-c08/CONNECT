/**
 * Shared export utilities for CSV and PDF generation.
 * Uses native browser APIs for CSV; jsPDF + jspdf-autotable for PDF.
 */

// ─── CSV ────────────────────────────────────────────────────────────────────

export interface ExportColumn {
  header: string;
  key: string;
}

function escapeCSVValue(value: any): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportToCSV(
  rows: Record<string, any>[],
  columns: ExportColumn[],
  filename: string
): void {
  const header = columns.map((c) => escapeCSVValue(c.header)).join(',');
  const body = rows
    .map((row) => columns.map((c) => escapeCSVValue(row[c.key])).join(','))
    .join('\n');

  const csv = `${header}\n${body}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ─── Logo Loader ─────────────────────────────────────────────────────────────

async function loadLogoBase64(src = '/images/Markdot logo white.png'): Promise<string | null> {
  try {
    const resp = await fetch(src);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// ─── PDF ─────────────────────────────────────────────────────────────────────

export async function exportToPDF(
  rows: Record<string, any>[],
  columns: ExportColumn[],
  title: string,
  filename: string
): Promise<void> {
  const jsPDFModule = await import('jspdf');
  const autoTableModule = await import('jspdf-autotable');

  const jsPDF = jsPDFModule.default;
  const autoTable = autoTableModule.default;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // Dark header bar
  doc.setFillColor(14, 14, 20);
  doc.rect(0, 0, 297, 26, 'F');

  // Subtle red accent line below header
  doc.setFillColor(239, 68, 68);
  doc.rect(0, 26, 297, 0.6, 'F');

  // Markdot logo top-right
  const logoBase64 = await loadLogoBase64('/images/Markdot logo white.png');
  if (logoBase64) {
    // Logo placed right-aligned in header
    doc.addImage(logoBase64, 'PNG', 250, 3, 34, 16, undefined, 'FAST');
  }

  // Title
  doc.setTextColor(239, 68, 68);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(title.toUpperCase(), 14, 13);

  // Meta
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `GENERATED: ${new Date().toLocaleString()}   |   RECORDS: ${rows.length}`,
    14,
    21
  );

  autoTable(doc, {
    startY: 30,
    head: [columns.map((c) => c.header)],
    body: rows.map((row) => columns.map((c) => row[c.key] ?? '')),
    styles: {
      fontSize: 8,
      cellPadding: 3,
      font: 'helvetica',
      textColor: [226, 232, 240],
      fillColor: [14, 14, 18],
      lineColor: [39, 39, 50],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [20, 20, 26],
      textColor: [239, 68, 68],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'left',
    },
    alternateRowStyles: {
      fillColor: [18, 18, 24],
    },
    margin: { left: 10, right: 10 },
  });

  // Page footer
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(6.5);
    doc.setTextColor(71, 85, 105);
    doc.text(
      `MARKDOT DOTCORE HRM  //  PAGE ${i} OF ${pageCount}`,
      14,
      doc.internal.pageSize.getHeight() - 5
    );
  }

  doc.save(`${filename}.pdf`);
}

// ─── Payslip PDF ─────────────────────────────────────────────────────────────

export interface PayslipData {
  employee: {
    fullName: string;
    employeeId: string;
    jobTitle: string;
    employmentType: string;
    email: string;
    joiningDate: string;
    basicPay: number;
    overtimeEligible: boolean;
  };
  period: { month: string; year: string };
  earnings: {
    basicPay: number;       // fixed monthly salary from employee record
    overtimePay: number;
    grossEarnings: number;
  };
  deductions: {
    tds: number;
    pf: number;
    totalDeductions: number;
  };
  netPay: number;
  workingDays: number;
  totalHours: number;
  otHours: number;
}

export async function generatePayslipPDF(data: PayslipData, elementId?: string): Promise<void> {
  const jsPDFModule = await import('jspdf');
  const jsPDF = jsPDFModule.default;

  const month = data.period.month.toLowerCase().replace(' ', '_');
  const filename = `payslip_${data.employee.employeeId}_${month}_${data.period.year}.pdf`;

  // Render via high-density 300DPI html2canvas rasterization to lock document text against 3rd party editors (Foxit, Acrobat Pro, Nitro)
  const targetId = elementId || 'payslip-preview-card';
  const element = typeof document !== 'undefined' ? document.getElementById(targetId) : null;

  if (element) {
    try {
      const html2canvasModule = await import('html2canvas');
      const html2canvas = html2canvasModule.default;

      const canvas = await html2canvas(element, {
        scale: 3, // 300+ DPI razor-sharp print quality
        useCORS: true,
        backgroundColor: '#0e0e14',
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      // Non-editable security metadata
      doc.setProperties({
        title: `Payslip_${data.employee.employeeId}_${data.period.month}_${data.period.year}`,
        subject: 'Official Employee Payslip - Flattened Secured Read-Only Document',
        author: 'MARKDOT INTELLECT HRMS',
        keywords: 'payslip, read-only, non-editable, secured',
        creator: 'MARKDOT INTELLECT HRMS (Secured Read-Only PDF)',
      });

      const pdfWidth = 210;
      const pdfHeight = 297;
      const marginX = 10;
      const imgWidth = pdfWidth - marginX * 2;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const marginY = Math.max(10, (pdfHeight - imgHeight) / 3);

      // Dark background container page styling
      doc.setFillColor(14, 14, 20);
      doc.rect(0, 0, pdfWidth, pdfHeight, 'F');

      doc.addImage(imgData, 'PNG', marginX, marginY, imgWidth, imgHeight, undefined, 'FAST');
      doc.save(filename);
      return;
    } catch (err) {
      console.warn('Canvas PDF export fallback to vector layout:', err);
    }
  }

  const autoTableModule = await import('jspdf-autotable');
  const autoTable = autoTableModule.default;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // Set PDF security & document properties (non-editable read-only format)
  doc.setProperties({
    title: `Payslip_${data.employee.employeeId}_${data.period.month}_${data.period.year}`,
    subject: 'Official Employee Payslip - Read Only',
    author: 'MARKDOT INTELLECT HRMS',
    keywords: 'payslip, read-only, confidential',
    creator: 'MARKDOT INTELLECT HRMS (Secured Read-Only PDF)',
  });

  const W = 210; // A4 width
  let y = 0;

  // ── Header Band ────────────────────────────────────────────────
  doc.setFillColor(14, 14, 20);
  doc.rect(0, 0, W, 38, 'F');

  doc.setFillColor(239, 68, 68);
  doc.rect(0, 38, W, 0.8, 'F');

  // Logo (Original size 1068x199 ratio = 5.3668, un-stretched dimensions)
  const logoBase64 = await loadLogoBase64('/images/Markdot logo white.png');
  if (logoBase64) {
    doc.addImage(logoBase64, 'PNG', 14, 12, 53.67, 10, undefined, 'FAST');
  }

  // Company name & address right side
  doc.setTextColor(226, 232, 240);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('MARKDOT INTELLECT', W - 14, 13, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('Human Resource Management System', W - 14, 19, { align: 'right' });
  doc.text('contact@markdotintellect.com', W - 14, 25, { align: 'right' });

  // PAYSLIP title centered
  doc.setTextColor(239, 68, 68);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('PAYSLIP', W / 2, 32, { align: 'center' });
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.text(`Pay Period: ${data.period.month} ${data.period.year}`, W / 2, 37, { align: 'center' });

  y = 46;

  // ── Employee Info Block ────────────────────────────────────────
  doc.setFillColor(20, 20, 26);
  doc.roundedRect(12, y, W - 24, 38, 2, 2, 'F');
  doc.setDrawColor(39, 39, 50);
  doc.setLineWidth(0.3);
  doc.roundedRect(12, y, W - 24, 38, 2, 2, 'S');

  doc.setTextColor(100, 116, 139);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.text('EMPLOYEE DETAILS', 18, y + 7);

  // Clean 2-column key-value alignment (prevent overlapping text)
  const col1LabelX = 18;
  const col1ValX   = 44;
  const col2LabelX = 108;
  const col2ValX   = 144;

  const infoItems = [
    ['Name', data.employee.fullName],
    ['Employee ID', data.employee.employeeId],
    ['Designation', data.employee.jobTitle || '—'],
    ['Employment', data.employee.employmentType],
  ];
  const infoRight = [
    ['Email', data.employee.email],
    ['Date of Joining', data.employee.joiningDate],
    ['Basic Pay (Monthly)', `Rs. ${data.employee.basicPay.toLocaleString()}`],
    ['Working Days', String(data.workingDays)],
  ];

  let ey = y + 14;
  infoItems.forEach(([label, value]) => {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(7);
    doc.text(label + ':', col1LabelX, ey);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(226, 232, 240);
    doc.text(String(value), col1ValX, ey);
    ey += 6;
  });

  ey = y + 14;
  infoRight.forEach(([label, value]) => {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(7);
    doc.text(label + ':', col2LabelX, ey);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(226, 232, 240);
    doc.text(String(value), col2ValX, ey);
    ey += 6;
  });

  y += 44;

  // ── Work Summary Row ──────────────────────────────────────────
  const summaryItems = [
    { label: 'Total Hours',   value: `${data.totalHours.toFixed(2)} hrs` },
    { label: 'OT Hours',      value: `${data.otHours.toFixed(2)} hrs` },
    { label: 'Basic Pay',     value: `Rs. ${data.earnings.basicPay.toFixed(2)}` },
    { label: 'OT Pay',        value: `Rs. ${data.earnings.overtimePay.toFixed(2)}` },
  ];

  const boxW = (W - 24 - 9) / 4;
  summaryItems.forEach((item, i) => {
    const bx = 12 + i * (boxW + 3);
    doc.setFillColor(18, 18, 24);
    doc.roundedRect(bx, y, boxW, 18, 1.5, 1.5, 'F');
    doc.setDrawColor(39, 39, 50);
    doc.setLineWidth(0.25);
    doc.roundedRect(bx, y, boxW, 18, 1.5, 1.5, 'S');
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.text(item.label, bx + boxW / 2, y + 6.5, { align: 'center' });
    doc.setTextColor(226, 232, 240);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(item.value, bx + boxW / 2, y + 14, { align: 'center' });
  });
  y += 24;

  // ── Earnings & Deductions Table ───────────────────────────────
  const earningsRows = [
    ['Basic Pay (Monthly)', `Rs. ${data.earnings.basicPay.toFixed(2)}`],
    ['Overtime Pay',        `Rs. ${data.earnings.overtimePay.toFixed(2)}`],
    ['GROSS EARNINGS',      `Rs. ${data.earnings.grossEarnings.toFixed(2)}`],
  ];

  const deductionsRows = [
    ['Tax Deducted at Source (TDS)', `Rs. ${data.deductions.tds.toFixed(2)}`],
    ['Provident Fund (PF)', `Rs. ${data.deductions.pf.toFixed(2)}`],
    ['TOTAL DEDUCTIONS', `Rs. ${data.deductions.totalDeductions.toFixed(2)}`],
  ];

  // Left: Earnings
  autoTable(doc, {
    startY: y,
    tableWidth: (W - 28) / 2,
    margin: { left: 12, right: W / 2 + 2 },
    head: [['EARNINGS', 'AMOUNT']],
    body: earningsRows,
    styles: {
      fontSize: 7.5,
      cellPadding: { top: 3, bottom: 3, left: 5, right: 5 },
      textColor: [226, 232, 240],
      fillColor: [14, 14, 18],
      lineColor: [39, 39, 50],
      lineWidth: 0.2,
    },
    headStyles: { fillColor: [20, 20, 26], textColor: [239, 68, 68], fontStyle: 'bold', fontSize: 7 },
    alternateRowStyles: { fillColor: [18, 18, 24] },
    didParseCell: (hookData) => {
      if (hookData.row.index === earningsRows.length - 1) {
        hookData.cell.styles.fontStyle = 'bold';
        hookData.cell.styles.textColor = [52, 211, 153]; // emerald
        hookData.cell.styles.fillColor = [14, 40, 28];
      }
    },
  });

  // Right: Deductions
  autoTable(doc, {
    startY: y,
    tableWidth: (W - 28) / 2,
    margin: { left: W / 2 + 2, right: 12 },
    head: [['DEDUCTIONS', 'AMOUNT']],
    body: deductionsRows,
    styles: {
      fontSize: 7.5,
      cellPadding: { top: 3, bottom: 3, left: 5, right: 5 },
      textColor: [226, 232, 240],
      fillColor: [14, 14, 18],
      lineColor: [39, 39, 50],
      lineWidth: 0.2,
    },
    headStyles: { fillColor: [20, 20, 26], textColor: [239, 68, 68], fontStyle: 'bold', fontSize: 7 },
    alternateRowStyles: { fillColor: [18, 18, 24] },
    didParseCell: (hookData) => {
      if (hookData.row.index === deductionsRows.length - 1) {
        hookData.cell.styles.fontStyle = 'bold';
        hookData.cell.styles.textColor = [248, 113, 113]; // red
        hookData.cell.styles.fillColor = [40, 14, 14];
      }
    },
  });

  // ── Net Pay Banner ────────────────────────────────────────────
  const tableEndY = (doc as any).lastAutoTable.finalY + 8;
  doc.setFillColor(239, 68, 68);
  doc.roundedRect(12, tableEndY, W - 24, 20, 2, 2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('NET PAY', 20, tableEndY + 8);
  doc.text(`( ${data.period.month} ${data.period.year} )`, 20, tableEndY + 15);

  doc.setFontSize(14);
  doc.text(`Rs. ${data.netPay.toFixed(2)}`, W - 18, tableEndY + 13, { align: 'right' });

  // ── Footer ────────────────────────────────────────────────────
  const footerY = tableEndY + 28;
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.text('This is a computer-generated payslip and does not require a signature.', W / 2, footerY, { align: 'center' });
  doc.text('MARKDOT INTELLECT HRM  //  SECURED READ-ONLY DOCUMENT', W / 2, footerY + 5, { align: 'center' });

  doc.save(filename);
}
